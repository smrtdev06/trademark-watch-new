import { Router, type IRouter } from "express";
import { eq, sql, count, desc, and, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  db,
  rawQuery,
  monitoringKeywordsTable,
  monitoringResultsTable,
  monitoringScopesTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";
import { enqueueScopesForKeyword, normalizeMonitoringClass } from "../lib/monitoringEnqueue";
import { monitoringProcessScope } from "../cron/jobs/monitoringProcessScope";
import {
  buildJournalCopyUrl,
  formatConflictClassDisplay,
  monitoringScoreToHumanRead,
} from "../lib/monitoringViewPhp";

function splitComma(s: string | undefined): string[] {
  if (!s?.trim()) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

const MONITORING_RESULT_SORT_KEYS = new Set([
  "journalDate",
  "sourceKeyword",
  "country",
  "conflict",
  "appno",
  "class",
  "client",
  "score",
]);

/** PHP default: JournalDate desc. Matches Livewire column sort. */
function monitoringResultsOrderBy(sortByRaw: string | undefined, sortDirRaw: string | undefined) {
  const sortBy = MONITORING_RESULT_SORT_KEYS.has(String(sortByRaw))
    ? String(sortByRaw)
    : "journalDate";
  const sortDir = sortDirRaw === "asc" ? "asc" : "desc";

  const journalExpr = sql`COALESCE(
    CASE WHEN mr.journal_date ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN TO_DATE(mr.journal_date, 'DD/MM/YYYY') END,
    CASE WHEN mr.journal_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN mr.journal_date::date END,
    mr.created_at::date
  )`;

  const asc = <T extends ReturnType<typeof sql>>(expr: T) =>
    sortDir === "asc"
      ? sql`ORDER BY ${expr} ASC NULLS LAST, mr.id DESC`
      : sql`ORDER BY ${expr} DESC NULLS LAST, mr.id DESC`;

  switch (sortBy) {
    case "sourceKeyword":
      return asc(sql`mk.keyword`);
    case "country":
      return asc(sql`mr.country`);
    case "conflict":
      return asc(sql`mr.tm_applied_for`);
    case "appno":
      return asc(sql`mr.appno`);
    case "class":
      return asc(sql`mr.conflict_class`);
    case "client":
      return asc(sql`COALESCE(c.name, '')`);
    case "score":
      return asc(sql`mr.score`);
    case "journalDate":
    default:
      return asc(journalExpr);
  }
}

const router: IRouter = Router();

router.get("/monitoring/keywords", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;
  const country = req.query.country as string;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;

  let where = isAdmin ? sql`1=1` : sql`mk.user_id = ${userId}`;
  if (search) where = sql`${where} AND mk.keyword ILIKE ${'%' + search + '%'}`;
  if (country) where = sql`${where} AND mk.country = ${country}`;
  if (clientId) where = sql`${where} AND mk.client_id = ${clientId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM monitoring_keywords mk WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT mk.*, c.name as client_name, u.name as user_name, u.email as user_email
    FROM monitoring_keywords mk
    LEFT JOIN clients c ON mk.client_id = c.id
    LEFT JOIN users u ON mk.user_id = u.id
    WHERE ${where}
    ORDER BY mk.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const keywords = (data as any[]).map((r: any) => ({
    id: r.id, keyword: r.keyword, country: r.country, class: r.class,
    userId: r.user_id, clientId: r.client_id, clientName: r.client_name,
    userName: r.user_name, userEmail: r.user_email,
    createdAt: r.created_at,
  }));

  res.json({ data: keywords, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/monitoring/keywords", requireAuth, async (req, res): Promise<void> => {
  const { keyword, country, class: cls } = req.body;
  const rawClient = req.body.clientId;
  const clientIdParsed =
    rawClient === null || rawClient === undefined || rawClient === ""
      ? null
      : Number(rawClient);

  if (!keyword || country == null || country === "" || cls == null || cls === "") {
    res.status(400).json({ status: 400, message: "keyword, country, and class are required" });
    return;
  }

  if (clientIdParsed !== null && (!Number.isFinite(clientIdParsed) || clientIdParsed <= 0)) {
    res.status(400).json({ status: 400, message: "clientId must be a positive integer or omitted" });
    return;
  }

  const normalizedClass = normalizeMonitoringClass(String(cls));
  if (!normalizedClass.replace(/\|/g, "").trim()) {
    res.status(400).json({ status: 400, message: "class is required" });
    return;
  }

  const countries = String(country)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (countries.length === 0) {
    res.status(400).json({ status: 400, message: "country is required" });
    return;
  }

  const insertedIds: number[] = [];

  for (const c of countries) {
    const inserted = await db.insert(monitoringKeywordsTable).values({
      keyword: String(keyword).trim(),
      country: c.toUpperCase(),
      class: normalizedClass,
      clientId: clientIdParsed,
      userId: req.user!.id,
    }).returning({ id: monitoringKeywordsTable.id });

    const newId = inserted[0]?.id;
    if (newId == null) {
      logger.error("monitoring_keywords INSERT returned no id (RETURNING); keyword row may exist without scopes");
      res.status(500).json({
        status: 500,
        message: "Could not confirm keyword insert. If a row was created, scopes may be missing — re-save or run enqueue manually.",
      });
      return;
    }

    const [fullKeyword] = await db
      .select()
      .from(monitoringKeywordsTable)
      .where(eq(monitoringKeywordsTable.id, newId))
      .limit(1);

    if (!fullKeyword) {
      logger.error({ newId }, "monitoring_keywords row missing after insert");
      res.status(500).json({ status: 500, message: "Keyword insert inconsistent" });
      return;
    }

    insertedIds.push(fullKeyword.id);

    try {
      await enqueueScopesForKeyword(fullKeyword);
    } catch (err) {
      logger.error({ err, keywordId: fullKeyword.id }, "enqueueScopesForKeyword failed");
      await db.delete(monitoringKeywordsTable).where(eq(monitoringKeywordsTable.id, fullKeyword.id));
      res.status(500).json({
        status: 500,
        message: "Could not create monitoring scopes for this keyword",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    /* Run processor immediately so users are not blocked on the 1-minute cron tick (PHP queue was delayed too). */
    const countryUpper = fullKeyword.country.trim().toUpperCase();
    setImmediate(() => {
      void monitoringProcessScope(countryUpper === "IN" ? "IN" : undefined).catch(() => {});
    });
  }

  res.json({
    status: 200,
    message: insertedIds.length > 1 ? "Keywords added" : "Keyword added",
    ids: insertedIds,
  });
});

router.put("/monitoring/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { country, class: cls, clientId } = req.body;
  const isAdmin = req.user!.role === "admin";
  const conditions = isAdmin
    ? eq(monitoringKeywordsTable.id, id)
    : sql`id = ${id} AND user_id = ${req.user!.id}`;
  const updateData: Record<string, any> = {};
  if (country !== undefined) updateData.country = String(country).trim().toUpperCase();
  if (cls !== undefined) {
    const nc = normalizeMonitoringClass(String(cls));
    if (!nc.replace(/\|/g, "").trim()) {
      res.status(400).json({ status: 400, message: "Invalid class" });
      return;
    }
    updateData.class = nc;
  }
  if (clientId !== undefined) updateData.clientId = clientId;
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ status: 400, message: "No fields to update" });
    return;
  }
  const result = await db.update(monitoringKeywordsTable).set(updateData).where(conditions);
  const rowCount = (result as any).rowCount ?? (result as any).changes ?? 0;
  if (rowCount === 0) {
    res.status(404).json({ status: 404, message: "Keyword not found or not authorized" });
    return;
  }
  res.json({ status: 200, message: "Keyword updated" });
});

/** Remove existing scope rows for this keyword and enqueue fresh ones (status 0), then schedule a process run. */
router.post("/monitoring/keywords/:id/requeue-scopes", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  const keywordWhere = isAdmin
    ? eq(monitoringKeywordsTable.id, id)
    : sql`id = ${id} AND user_id = ${req.user!.id}`;

  const [kw] = await db.select().from(monitoringKeywordsTable).where(keywordWhere).limit(1);
  if (!kw) {
    res.status(404).json({ status: 404, message: "Keyword not found or not authorized" });
    return;
  }

  await db.delete(monitoringScopesTable).where(eq(monitoringScopesTable.keywordId, id));

  try {
    await enqueueScopesForKeyword(kw);
  } catch (err) {
    logger.error({ err, keywordId: id }, "requeue-scopes: enqueue failed");
    res.status(500).json({
      status: 500,
      message: "Failed to create new monitoring scopes",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const countryUpper = kw.country.trim().toUpperCase();
  setImmediate(() => {
    void monitoringProcessScope(countryUpper === "IN" ? "IN" : undefined).catch(() => {});
  });

  res.json({ status: 200, message: "Scopes re-queued", keywordId: id });
});

router.delete("/monitoring/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  const keywordWhere = isAdmin
    ? eq(monitoringKeywordsTable.id, id)
    : sql`id = ${id} AND user_id = ${req.user!.id}`;

  const [existing] = await db
    .select({ id: monitoringKeywordsTable.id })
    .from(monitoringKeywordsTable)
    .where(keywordWhere)
    .limit(1);

  if (!existing) {
    res.status(404).json({ status: 404, message: "Keyword not found or not authorized" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(monitoringResultsTable).where(eq(monitoringResultsTable.keywordId, id));
    await tx.delete(monitoringScopesTable).where(eq(monitoringScopesTable.keywordId, id));
    await tx.delete(monitoringKeywordsTable).where(eq(monitoringKeywordsTable.id, id));
  });

  res.json({ status: 200, message: "Keyword deleted" });
});

router.get("/monitoring/results", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const q = req.query;

  const search = typeof q.search === "string" ? q.search.trim() : "";
  const conflict = typeof q.conflict === "string" ? q.conflict.trim() : "";
  const conflictAppno = typeof q.conflictAppno === "string" ? q.conflictAppno.trim() : "";

  const countries = splitComma(q.country as string);
  const journalDates = splitComma(q.journalDates as string).length
    ? splitComma(q.journalDates as string)
    : q.journalDate
      ? [String(q.journalDate)]
      : [];
  const clientIdsFromParam = splitComma(q.clientIds as string)
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
  const clientIdSingle = q.clientId ? parseInt(String(q.clientId), 10) : NaN;
  const clients = clientIdsFromParam.length
    ? clientIdsFromParam
    : !Number.isNaN(clientIdSingle)
      ? [clientIdSingle]
      : [];

  const keywordStrings = splitComma(q.keywords as string);
  const conflictClasses = [
    ...splitComma(q.classFilter as string),
    ...splitComma(q.conflictClasses as string),
  ].filter(Boolean);

  const scoreFilters = splitComma(q.scores as string)
    .map((x) => parseInt(x, 10))
    .filter((n) => [100, 90, 80, 70].includes(n));

  const keywordId = q.keywordId ? parseInt(String(q.keywordId), 10) : NaN;

  const orderBy = monitoringResultsOrderBy(
    typeof q.sortBy === "string" ? q.sortBy : undefined,
    typeof q.sortDir === "string" ? q.sortDir : undefined,
  );

  let where = isAdmin ? sql`1=1` : sql`mr.user_id = ${userId}`;

  if (search) {
    const like = `%${search}%`;
    where = sql`${where} AND (
      mr.keyword ILIKE ${like}
      OR mk.keyword ILIKE ${like}
      OR mr.tm_applied_for ILIKE ${like}
      OR mr.appno ILIKE ${like}
    )`;
  }
  if (conflict) where = sql`${where} AND mr.tm_applied_for ILIKE ${"%" + conflict + "%"}`;
  if (conflictAppno) where = sql`${where} AND mr.appno ILIKE ${"%" + conflictAppno + "%"}`;

  if (countries.length === 1) {
    where = sql`${where} AND mr.country = ${countries[0]}`;
  } else if (countries.length > 1) {
    where = sql`${where} AND (${sql.join(
      countries.map((c) => sql`mr.country = ${c}`),
      sql` OR `,
    )})`;
  }

  if (journalDates.length === 1) {
    where = sql`${where} AND mr.journal_date = ${journalDates[0]}`;
  } else if (journalDates.length > 1) {
    where = sql`${where} AND (${sql.join(
      journalDates.map((j) => sql`mr.journal_date = ${j}`),
      sql` OR `,
    )})`;
  }

  if (clients.length === 1) {
    where = sql`${where} AND mr.client_id = ${clients[0]}`;
  } else if (clients.length > 1) {
    where = sql`${where} AND (${sql.join(
      clients.map((id) => sql`mr.client_id = ${id}`),
      sql` OR `,
    )})`;
  }

  if (!Number.isNaN(keywordId)) {
    where = sql`${where} AND mr.keyword_id = ${keywordId}`;
  }

  if (keywordStrings.length) {
    where = sql`${where} AND (${sql.join(
      keywordStrings.map((k) => sql`mk.keyword = ${k}`),
      sql` OR `,
    )})`;
  }

  if (conflictClasses.length) {
    where = sql`${where} AND (${sql.join(
      conflictClasses.map((c) => {
        const num = String(c).replace(/\D/g, "");
        return sql`(mr.conflict_class LIKE ${"%|" + num + "|%"} OR mr.conflict_class LIKE ${"%" + num + "%"})`;
      }),
      sql` OR `,
    )})`;
  }

  if (scoreFilters.length) {
    const bucketParts = scoreFilters.map((sf) => {
      if (sf === 100) return sql`(mr.score >= 95)`;
      if (sf === 90) return sql`(mr.score >= 85 AND mr.score < 95)`;
      if (sf === 80) return sql`(mr.score >= 75 AND mr.score < 85)`;
      if (sf === 70) return sql`(mr.score >= 65 AND mr.score < 75)`;
      return sql`FALSE`;
    });
    where = sql`${where} AND (${sql.join(bucketParts, sql` OR `)})`;
  }

  const totalRows = await rawQuery(sql`
    SELECT count(*)::int as count
    FROM monitoring_results mr
    LEFT JOIN monitoring_keywords mk ON mk.id = mr.keyword_id
    WHERE ${where}
  `);
  const total = Number((totalRows as any)[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT mr.*, mk.keyword as source_keyword, mk.country as source_country_code,
           c.name as client_name, u.name as user_name, u.email as user_email
    FROM monitoring_results mr
    LEFT JOIN monitoring_keywords mk ON mk.id = mr.keyword_id
    LEFT JOIN clients c ON mr.client_id = c.id
    LEFT JOIN users u ON mr.user_id = u.id
    WHERE ${where}
    ${orderBy}
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => {
    const journalCopyUrl =
      r.journal_copy_url ||
      buildJournalCopyUrl(r.source_country_code || r.country, r.appno, r.journal_date);
    return {
      id: r.id,
      keywordId: r.keyword_id,
      keyword: r.keyword,
      sourceKeyword: r.source_keyword ?? r.keyword,
      wordToCompare: r.word_to_compare,
      appno: r.appno,
      journalDate: r.journal_date,
      score: r.score,
      scoreLabel: monitoringScoreToHumanRead(r.score),
      conflictClass: r.conflict_class,
      conflictClassDisplay: formatConflictClassDisplay(r.conflict_class),
      conflictCountry: r.conflict_country,
      conflictStatus: r.conflict_status,
      tmAppliedFor: r.tm_applied_for,
      userDetail: r.user_detail,
      country: r.country,
      class: r.class,
      clientName: r.client_name,
      userName: r.user_name,
      userEmail: r.user_email,
      journalCopyUrl,
      favorite: Boolean(r.favorite),
    };
  });

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

/** PHP ViewResults::favorite — toggles `favorite` on the monitoring result row */
router.post("/monitoring/results/:id/favorite", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ status: 400, message: "Invalid id" });
    return;
  }
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  const rows = await db.select().from(monitoringResultsTable).where(eq(monitoringResultsTable.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ status: 404, message: "Not found" });
    return;
  }
  if (!isAdmin && row.userId !== userId) {
    res.status(403).json({ status: 403, message: "Forbidden" });
    return;
  }

  const newFavorite = !row.favorite;
  await db.update(monitoringResultsTable).set({ favorite: newFavorite }).where(eq(monitoringResultsTable.id, id));

  res.json({ id, favorite: newFavorite });
});

router.post("/monitoring/results/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_monitoring_results.xlsx" });
});

router.post("/monitoring/import", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, added: 0, message: "Import feature placeholder" });
});

router.get("/monitoring/filters", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const filter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;

  const journalsRaw = await rawQuery(sql`SELECT DISTINCT journal_date FROM monitoring_results WHERE ${filter} AND journal_date IS NOT NULL ORDER BY journal_date DESC`);
  const countriesRaw = await rawQuery(sql`SELECT DISTINCT country FROM monitoring_keywords WHERE ${filter} AND country IS NOT NULL ORDER BY country`);
  const keywordsRaw = await rawQuery(sql`SELECT DISTINCT keyword FROM monitoring_keywords WHERE ${filter} ORDER BY keyword`);

  /** PHP tm-watch view: class filter options are fixed 1–45 + 99 (conflict Nice classes). */
  const classesStatic = [...Array.from({ length: 45 }, (_, i) => i + 1), 99];

  /** PHP: Auth::user()->clients() — filter dropdown is always the current user’s clients. */
  const clients = await db.select().from(clientsTable).where(eq(clientsTable.userId, userId));

  res.json({
    journals: (journalsRaw as any[]).map((r: any) => r.journal_date),
    countries: (countriesRaw as any[]).map((r: any) => r.country),
    keywords: (keywordsRaw as any[]).map((r: any) => r.keyword),
    classes: classesStatic,
    clients,
    scoreOptions: [
      { value: 100, label: "Very High" },
      { value: 90, label: "High" },
      { value: 80, label: "Medium" },
      { value: 70, label: "Low" },
    ],
  });
});

export default router;

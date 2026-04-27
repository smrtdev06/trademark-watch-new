import { db } from "@workspace/db";
import { monitoringScopesTable, monitoringResultsTable, monitoringKeywordsTable } from "@workspace/db";
import { eq, and, isNull, sql, inArray, count, or } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { monitoringGraphQlHeaders } from "../../lib/graphqlMonitoringAuth";
import {
  checkWordPhp,
  similarityScoreBulkPhp,
  similarityScoreLevenshteinBulkRawMin,
  checkSameClassPhp,
  highestFuzzyLikePhp,
} from "../../lib/monitoringSimilarityPhp";

const GRAPHQL_URL = process.env.GRAPHQL_MONITORING_URL ?? "https://trans.rasr.in/graphql";
const INDIA_MONITORING_URL = process.env.INDIA_MONITORING_URL ?? "http://45.157.178.123:8000";
const SCOPE_SIZE = Math.max(1, parseInt(process.env.SCOPES_PER_MIN ?? "15", 10) || 15);

/** PHP date('d/m/Y', strtotime('last Monday')) in local time. */
function lastMondayDdMmYyyy(): string {
  const d = new Date('2026-04-17');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toLocaleDateString("en-GB");
}

/** Parse YYYY-MM-DD without timezone shift (Date-only strings are UTC in JS and can flip calendar day). */
function isoYmdToDdMmYyyy(raw: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Scope variables use journalDate ISO; India HTTP API expects DD/MM/YYYY query param `date`. */
function journalDateToIndiaQueryDate(vars: any): string {
  const raw = vars?.journalDate;
  if (raw) {
    const direct = isoYmdToDdMmYyyy(raw);
    if (direct) return direct;
    const parsed = new Date(raw as string);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-GB");
    }
  }
  return lastMondayDdMmYyyy();
}

/**
 * PHP Monitoring::checkUrl — probe India HTTP API (not bare host: root often 404 while `/?date=&tm_applied_for=` works).
 * Set INDIA_MONITORING_SKIP_HEALTHCHECK=1 to bypass (e.g. flaky firewall).
 */
async function indiaMonitoringReachable(): Promise<boolean> {
  const skip = process.env.INDIA_MONITORING_SKIP_HEALTHCHECK;
  if (skip === "1" || skip === "true") {
    return true;
  }
  const base = INDIA_MONITORING_URL.replace(/\/$/, "");
  const probeUrl = `${base}/?date=01/01/2020&tm_applied_for=__health__`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch(probeUrl, { method: "GET", signal: ac.signal });
    clearTimeout(t);
    const text = await res.text();
    try {
      JSON.parse(text);
      return true;
    } catch {
      return res.ok;
    }
  } catch {
    return false;
  }
}

/** When the filtered query returns no rows, explain common causes (wrong cron branch vs empty table vs all processed). */
async function logNoMatchingScopes(countryLower: string): Promise<void> {
  const [total] = await db
    .select({ n: count() })
    .from(monitoringScopesTable)
    .where(eq(monitoringScopesTable.status, 0));

  const [intl] = await db
    .select({ n: count() })
    .from(monitoringScopesTable)
    .where(
      and(eq(monitoringScopesTable.status, 0), or(isNull(monitoringScopesTable.countryCode), eq(monitoringScopesTable.countryCode, ""))),
    );

  const [india] = await db
    .select({ n: count() })
    .from(monitoringScopesTable)
    .where(
      and(eq(monitoringScopesTable.status, 0), sql`lower(${monitoringScopesTable.countryCode}) = 'in'`),
    );

  logger.info(
    {
      branch: countryLower === "in" ? "india" : "international",
      pendingStatus0Total: Number(total?.n ?? 0),
      pendingIntlCountryNullOrEmpty: Number(intl?.n ?? 0),
      pendingIndiaCountryIn: Number(india?.n ?? 0),
    },
    "monitoringProcessScope: no scopes in this batch — intl job only picks country_code NULL; India job picks country_code 'in'. Add keywords (POST /monitoring/keywords) or wait for monitoring:check:latest.",
  );
}

async function graphQlRequest(variables: any): Promise<any[] | false> {
  const query = `
    query ApplicationsQuery($keyword: String!, $countryCode: String, $journalDate: String, $offset: Int, $limit: Int) {
      applications: phoneticSearch(keyword: $keyword, countryCode: $countryCode, journalDate: $journalDate, offset: $offset, limit: $limit){
        appId
        tmname
        translation
        transliteration
        date
        journalDate
        creationDate
        image
        compNameAndAddress
        reprName
        countryCode
        appClass
      }
    }
  `;

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: monitoringGraphQlHeaders(),
      body: JSON.stringify({ query, variables }),
    });

    const bodyText = await response.text();
    let json: any;
    try {
      json = JSON.parse(bodyText);
    } catch {
      logger.warn({ status: response.status, preview: bodyText.slice(0, 200) }, "phoneticSearch: non-JSON response");
      return false;
    }

    if (!response.ok) {
      logger.warn({ status: response.status, errors: json?.errors }, "phoneticSearch HTTP error");
      return false;
    }
    if (json.errors?.length) {
      logger.warn({ errors: json.errors, variables }, "phoneticSearch GraphQL errors");
      return false;
    }
    return json.data?.applications ?? [];
  } catch (err) {
    logger.error({ err }, "GraphQL request failed");
    return false;
  }
}

async function indiaRequest(date: string, keyword: string): Promise<any[] | false> {
  const params = new URLSearchParams({ date, tm_applied_for: keyword });
  try {
    const response = await fetch(`${INDIA_MONITORING_URL.replace(/\/$/, "")}/?${params}`);
    if (!response.ok) return false;
    const json = (await response.json()) as unknown;
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)) {
      return (json as { data: unknown[] }).data;
    }
    return [];
  } catch (err) {
    logger.error({ err }, "India monitoring request failed");
    return false;
  }
}

/** Map India HTTP JSON to the shape PHP normalizeResponse() produces (keys may vary by API version). */
function normalizeIndiaResponse(m: any) {
  const r = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
  const appnoRaw = r.appno ?? r.AppNo ?? r.app_no ?? r.applicationNumber;
  const appIdStr = appnoRaw != null && appnoRaw !== "" ? String(appnoRaw) : "";
  return {
    tmname: (r.tm_applied_for ?? r.tmAppliedFor ?? r.tmname ?? r.tm_name) as string | undefined,
    reprName: r.agent_name ?? r.agentName as string | undefined,
    compNameAndAddress: (r.buisness_name ?? r.buisnessName ?? r.businessName) as string | undefined,
    date: r.app_date ?? r.dateOfApp as string | undefined,
    appClass: (r.class ?? r.Class ?? r.appClass ?? r.niceClass) as unknown,
    /** PHP Monitoring.php: merge classes from goods when 99 ∈ appClass */
    goodsAndSerice: (r.goods_and_serice ?? r.goodsAndSerice ?? r.goodsAndService ?? r.goods ?? r.specification ?? r.goodsAndServices) as
      | string
      | undefined,
    appId: appIdStr || undefined,
    appno: appIdStr || undefined,
    journalDate: (r.journal_date ?? r.JournalDate ?? r.journalDate) as string | undefined,
    countryCode: r.country as string | undefined,
    creationDate: r.createdAt as string | undefined,
  };
}

/** PHP uses explode('|', trim($classes, '|')); we also split commas for GraphQL responses. */
function normalizeClassToken(c: string): string {
  const n = parseInt(String(c).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? String(n) : c.trim();
}

function expandClasses(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => expandClasses(x));
  }
  const s = String(raw).trim();
  if (!s) return [];
  const parts = s.includes("|") ? s.split("|") : s.split(/[,;]/);
  return parts.map((p) => p.trim()).filter(Boolean).map(normalizeClassToken);
}

/** PHP getClassesFrom99 bracket form + common prose in Indian specs ("Class 25", "class : 30"). */
function extractClassesFromGoodsText(goodsAndSerice: string): string[] {
  const out = new Set<string>();
  const bracket = /\[class\s*:\s*([0-9]+)\]/gim;
  let m: RegExpExecArray | null;
  while ((m = bracket.exec(goodsAndSerice)) !== null) {
    out.add(normalizeClassToken(m[1]));
  }
  const prose = /\bclass\s*[:.]?\s*([0-9]{1,2})\b/gi;
  while ((m = prose.exec(goodsAndSerice)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 45) out.add(String(n));
  }
  return [...out];
}

/**
 * PHP Monitoring.php ~604–607: when class 99 is present, merge classes parsed from goodsAndSerice
 * before intersecting with the watch keyword (otherwise 99 rows never match real Nice classes).
 * If `class` is empty but goods lists classes, use goods-only list (some API payloads omit `class`).
 */
function expandConflictAppClasses(raw: unknown, goodsAndSerice: string | undefined | null): string[] {
  let parts = expandClasses(raw);
  const fromGoods = goodsAndSerice?.trim() ? extractClassesFromGoodsText(goodsAndSerice) : [];
  const has99 = parts.some((c) => c === "99" || parseInt(c, 10) === 99);
  if (has99 && fromGoods.length > 0) {
    parts = [...new Set([...parts, ...fromGoods])];
  }
  if (parts.length === 0 && fromGoods.length > 0) {
    parts = fromGoods;
  }
  return parts;
}

/** Intersect source keyword classes with conflict app classes (handles 99 + goods, 25 vs 025). */
function classesOverlap(
  sourceClassField: string,
  conflictAppClass: unknown,
  goodsAndSerice?: string | null,
): boolean {
  const src = expandClasses(sourceClassField);
  const dst = expandConflictAppClasses(conflictAppClass, goodsAndSerice);
  if (src.length === 0 || dst.length === 0) return false;
  const dstSet = new Set(dst);
  return src.some((c) => dstSet.has(c));
}

export async function monitoringProcessScope(country?: string) {
  const countryLower = country ? country.toLowerCase() : "";

  if (countryLower === "in") {
    const ok = await indiaMonitoringReachable();
    if (!ok) {
      logger.warn(
        { base: INDIA_MONITORING_URL },
        "India monitoring probe failed (PHP checkUrl). Set INDIA_MONITORING_SKIP_HEALTHCHECK=1 to bypass or fix INDIA_MONITORING_URL.",
      );
      await logNoMatchingScopes("in");
      return;
    }
  }

  const scopeQuery = db.select().from(monitoringScopesTable).where(
    and(
      eq(monitoringScopesTable.status, 0),
      countryLower === "in"
        ? sql`lower(${monitoringScopesTable.countryCode}) = 'in'`
        : or(isNull(monitoringScopesTable.countryCode), eq(monitoringScopesTable.countryCode, "")),
    ),
  ).limit(SCOPE_SIZE);

  const scopes = await scopeQuery;
  if (scopes.length === 0) {
    await logNoMatchingScopes(countryLower);
    return;
  }

  const scopeIds = scopes.map(s => s.id);
  await db.update(monitoringScopesTable)
    .set({ status: 1 })
    .where(inArray(monitoringScopesTable.id, scopeIds));

  const keywordIds = [...new Set(scopes.map(s => s.keywordId))];
  const existingResults = await db.select().from(monitoringResultsTable)
    .where(inArray(monitoringResultsTable.keywordId, keywordIds));
  const existingAppnos = new Set(existingResults.map(r => r.appno));

  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];
    const vars = scope.variables as any;
    if (!vars) continue;

    let results: any[] | false;

    if (countryLower === "in") {
      const dateFormatted = journalDateToIndiaQueryDate(vars);
      results = await indiaRequest(dateFormatted, vars.keyword);
      if (Array.isArray(results) && results.length === 0) {
        const fallback = lastMondayDdMmYyyy();
        if (fallback !== dateFormatted) {
          logger.info(
            { scopeId: scope.id, triedDate: dateFormatted, retryDate: fallback, keyword: vars.keyword },
            "India monitoring returned 0 apps; retrying with last Monday date",
          );
          results = await indiaRequest(fallback, vars.keyword);
        }
      }
    } else {
      results = await graphQlRequest(vars);
      if (Array.isArray(results) && results.length === 0 && vars?.journalDate) {
        logger.info({ keyword: vars.keyword, journalDate: vars.journalDate }, "phoneticSearch returned 0 rows; retry with empty journalDate");
        results = await graphQlRequest({ ...vars, journalDate: "" });
      }
    }

    if (results === false || !Array.isArray(results)) {
      await db.update(monitoringScopesTable)
        .set({ status: 0 })
        .where(eq(monitoringScopesTable.id, scope.id));
      continue;
    }

    const keyword = await db.select().from(monitoringKeywordsTable)
      .where(eq(monitoringKeywordsTable.id, scope.keywordId))
      .limit(1);

    if (!keyword.length) continue;
    const tm = keyword[0];
    const watchClasses = expandClasses(tm.class);
    if (watchClasses.length === 0) {
      logger.warn(
        { keywordId: tm.id, keyword: tm.keyword, rawClass: tm.class },
        "monitoring: keyword has no parseable classes — class overlap rejects all rows; set Nice classes on the keyword",
      );
    }

    const batchLog: Record<string, unknown> = {
      scopeId: scope.id,
      appsFromApi: results.length,
      keyword: vars?.keyword,
      countryCode: vars?.countryCode,
    };
    if (countryLower === "in") {
      batchLog.indiaQueryDate = journalDateToIndiaQueryDate(vars);
      batchLog.indiaBaseUrl = INDIA_MONITORING_URL.replace(/\/$/, "");
    }
    logger.info(batchLog, "phoneticSearch batch");
    if (countryLower === "in" && results.length === 0) {
      logger.info(
        {
          scopeId: scope.id,
          indiaQueryDate: batchLog.indiaQueryDate,
          keyword: vars?.keyword,
        },
        "India monitoring: 0 applications for this journal date — try another date or confirm INDIA_MONITORING_URL returns data for ?date=&tm_applied_for=",
      );
    }

    const skip = {
      noAppId: 0,
      duplicate: 0,
      noClassOverlap: 0,
      similarityGate: 0,
      sameClassRule: 0,
    };
    let inserted = 0;

    for (const monitoring of results) {
      const normalized = countryLower === "in" ? normalizeIndiaResponse(monitoring) : monitoring;
      const appId = String(normalized.appId || normalized.appno || "").trim();
      const goodsForClass =
        typeof normalized === "object" && normalized !== null
          ? (normalized as { goodsAndSerice?: string }).goodsAndSerice
          : undefined;

      if (!appId) {
        skip.noAppId++;
        continue;
      }
      if (existingAppnos.has(appId)) {
        skip.duplicate++;
        continue;
      }

      if (!classesOverlap(tm.class, normalized.appClass, goodsForClass)) {
        skip.noClassOverlap++;
        continue;
      }

      const wordToCompare = (scope.wordToCompare || "").toLowerCase().trim();
      /** PHP: substr(trim(strtolower(Similarity::checkWord($monitoring['tmname']))), 0, 253) */
      const monitoringTmAppliedFor = checkWordPhp(String(normalized.tmname || ""))
        .toLowerCase()
        .trim()
        .substring(0, 253);

      /** PHP FuzzyWuzzy max(ratio, partial, token_sort, token_set) — see highestFuzzyLikePhp. */
      const fuzzyApprox = highestFuzzyLikePhp(wordToCompare, monitoringTmAppliedFor);
      const similarityBulk = similarityScoreBulkPhp(wordToCompare, monitoringTmAppliedFor);
      const ldsBulkMin = similarityScoreLevenshteinBulkRawMin(wordToCompare, monitoringTmAppliedFor, 2);

      /**
       * PHP Monitoring.php ~688: if ($fuzziRation < 55 && $similarity < 49 && !$forceAddRecord) continue;
       * Light boost when the watch word appears inside the conflict name (PHP FuzzyWuzzy often scores this high).
       */
      let similarityForGate = similarityBulk;
      if (wordToCompare.length >= 2 && monitoringTmAppliedFor.includes(wordToCompare)) {
        similarityForGate = Math.max(similarityForGate, 52);
      }

      /**
       * PHP Monitoring.php ~688: if ($fuzziRation < 55 && $similarity < 49 && !$forceAddRecord) continue;
       * forceAddRecord (prefix/suffix rules) not ported — stays false.
       */
      const forceAddRecord = false;
      if (fuzzyApprox < 55 && similarityForGate < 49 && !forceAddRecord) {
        skip.similarityGate++;
        continue;
      }

      /**
       * PHP ~692: checkSameClass — skip when no class overlap path shouldn't happen here;
       * included for parity with PHP when class arrays gain extra paths (e.g. class 99 goods).
       */
      const appClassArr = expandConflictAppClasses(normalized.appClass, goodsForClass);
      const sourceClassesArr = expandClasses(tm.class);
      if (checkSameClassPhp(appClassArr, sourceClassesArr, ldsBulkMin, fuzzyApprox) && !forceAddRecord) {
        skip.sameClassRule++;
        continue;
      }

      try {
        await db.insert(monitoringResultsTable).values({
          keywordId: scope.keywordId,
          keyword: scope.keyword,
          wordToCompare: scope.wordToCompare,
          appno: appId,
          journalDate: normalized.journalDate || null,
          score: fuzzyApprox,
          conflictClass: String(normalized.appClass || ""),
          conflictCountry: normalized.countryCode || null,
          tmAppliedFor: normalized.tmname || null,
          userDetail: normalized.compNameAndAddress || null,
          country: tm.country,
          class: tm.class,
          userId: tm.userId,
          clientId: tm.clientId,
        });
        existingAppnos.add(appId);
        inserted++;
      } catch (err: any) {
        if (err.message?.includes("duplicate")) {
          skip.duplicate++;
        } else {
          logger.error({ err }, "Failed to insert monitoring result");
        }
      }
    }

    logger.info(
      { scopeId: scope.id, keywordId: scope.keywordId, inserted, skipped: skip, appsFromApi: results.length },
      "monitoringProcessScope: batch filtering summary",
    );
    if (countryLower === "in" && inserted === 0 && results.length > 0) {
      const first = results[0];
      const n0 = normalizeIndiaResponse(first);
      const g0 = n0.goodsAndSerice;
      const exp0 = expandConflictAppClasses(n0.appClass, g0);
      logger.info(
        {
          scopeId: scope.id,
          watchClasses,
          sampleRawConflictClass: n0.appClass,
          sampleExpandedConflictClasses: exp0.slice(0, 16),
          goodsTextPresent: Boolean(g0 && String(g0).trim().length > 0),
        },
        "monitoringProcessScope: zero inserts — compare watchClasses vs sampleExpandedConflictClasses",
      );
    }
    if (
      countryLower === "in" &&
      inserted === 0 &&
      results.length > 0 &&
      skip.noClassOverlap === results.length
    ) {
      const sample = results[0] && typeof results[0] === "object" ? Object.keys(results[0] as object) : [];
      logger.warn(
        { scopeId: scope.id, sampleKeys: sample },
        "All rows skipped: no class overlap — check keyword `class` vs API `class` field and normalizeIndiaResponse mapping",
      );
    }
  }

  await db.update(monitoringScopesTable)
    .set({ status: 2 })
    .where(and(
      inArray(monitoringScopesTable.id, scopeIds),
      eq(monitoringScopesTable.status, 1)
    ));
}

import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, rawQuery, socialKeywordsTable, socialResultsTable, clientsTable, usersTable } from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";

const router: IRouter = Router();

router.get("/social/keywords", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;

  let where = isAdmin ? sql`1=1` : sql`sk.user_id = ${userId}`;
  if (search) where = sql`${where} AND sk.keyword ILIKE ${'%' + search + '%'}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM social_keywords sk WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT sk.*, c.name as client_name, u.name as user_name, u.email as user_email
    FROM social_keywords sk
    LEFT JOIN clients c ON sk.client_id = c.id
    LEFT JOIN users u ON sk.user_id = u.id
    WHERE ${where}
    ORDER BY sk.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const keywords = (data as any[]).map((r: any) => ({
    id: r.id, keyword: r.keyword, site: r.site, freq: r.freq,
    category: r.category, userId: r.user_id, clientId: r.client_id,
    clientName: r.client_name, userName: r.user_name, userEmail: r.user_email,
    createdAt: r.created_at,
  }));

  res.json({ data: keywords, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/social/keywords", requireAuth, async (req, res): Promise<void> => {
  const { keyword, site, freq, category, clientId } = req.body;
  if (!keyword || !site || freq == null) {
    res.status(400).json({ status: 400, message: "keyword, site, and freq are required" });
    return;
  }
  await db.insert(socialKeywordsTable).values({
    keyword, site, freq, category, clientId, userId: req.user!.id,
  });
  res.json({ status: 200, message: "Social keyword added" });
});

router.put("/social/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { keyword, site, freq, category, clientId } = req.body;
  if (!keyword || !site || freq == null) {
    res.status(400).json({ status: 400, message: "keyword, site, and freq are required" });
    return;
  }
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const whereClause = isAdmin
    ? eq(socialKeywordsTable.id, id)
    : and(eq(socialKeywordsTable.id, id), eq(socialKeywordsTable.userId, userId));

  const updated = await db
    .update(socialKeywordsTable)
    .set({
      keyword,
      site,
      freq: Number(freq),
      category: category ?? null,
      clientId: clientId ?? null,
    })
    .where(whereClause!)
    .returning({ id: socialKeywordsTable.id });

  if (!updated.length) {
    res.status(404).json({ status: 404, message: "Keyword not found" });
    return;
  }
  res.json({ status: 200, message: "Social keyword updated" });
});

router.delete("/social/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  if (isAdmin) {
    await db.delete(socialKeywordsTable).where(eq(socialKeywordsTable.id, id));
  } else {
    await db.delete(socialKeywordsTable).where(sql`id = ${id} AND user_id = ${req.user!.id}`);
  }
  res.json({ status: 200, message: "Social keyword deleted" });
});

router.get("/social/results", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;
  const keywordId = req.query.keywordId ? parseInt(req.query.keywordId as string) : null;

  let where = isAdmin ? sql`1=1` : sql`sr.user_id = ${userId}`;
  if (search) where = sql`${where} AND sr.keyword ILIKE ${'%' + search + '%'}`;
  if (keywordId) where = sql`${where} AND sr.scale_serp_id = ${keywordId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM social_results sr WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT sr.*, c.name as client_name, u.name as user_name
    FROM social_results sr
    LEFT JOIN clients c ON sr.client_id = c.id
    LEFT JOIN users u ON sr.user_id = u.id
    WHERE ${where}
    ORDER BY sr.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id, scaleSerpId: r.scale_serp_id, keyword: r.keyword, site: r.site,
    title: r.title, link: r.link, snippet: r.snippet, position: r.position,
    pageUrl: r.page_url,
    imageFile: r.image_file, imageUrl: r.image_url,
    clientName: r.client_name, userName: r.user_name,
    createdAt: r.created_at,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/social/results/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_social_results.xlsx" });
});

export default router;

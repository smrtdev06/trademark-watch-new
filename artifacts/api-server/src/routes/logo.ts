import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db, rawQuery, logoSearchesTable, logoResultsTable, clientsTable } from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";

const router: IRouter = Router();

router.get("/logo", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  let where = isAdmin ? sql`1=1` : sql`ls.user_id = ${userId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM logo_searches ls WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT ls.*, c.name as client_name
    FROM logo_searches ls
    LEFT JOIN clients c ON ls.client_id = c.id
    WHERE ${where}
    ORDER BY ls.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const searches = (data as any[]).map((r: any) => ({
    id: r.id, file: r.file, fileUrl: r.file_url, userId: r.user_id,
    clientId: r.client_id, clientName: r.client_name, status: r.status,
    createdAt: r.created_at,
  }));

  res.json({ data: searches, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/logo", requireAuth, async (req, res): Promise<void> => {
  res.json({ status: 200, message: "Logo search uploaded (placeholder)" });
});

router.delete("/logo/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  if (isAdmin) {
    await db.delete(logoSearchesTable).where(eq(logoSearchesTable.id, id));
  } else {
    await db.delete(logoSearchesTable).where(sql`id = ${id} AND user_id = ${req.user!.id}`);
  }
  res.json({ status: 200, message: "Logo search deleted" });
});

router.get("/logo/results", requireAuth, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const logoSearchId = req.query.logoSearchId ? parseInt(req.query.logoSearchId as string) : null;

  let where = sql`1=1`;
  if (logoSearchId) where = sql`${where} AND logo_search_id = ${logoSearchId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM logo_results WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT * FROM logo_results
    WHERE ${where}
    ORDER BY id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id, logoSearchId: r.logo_search_id, matchScore: r.match_score,
    imageUrl: r.image_url, trademarkName: r.trademark_name,
    appno: r.appno, class: r.class, country: r.country,
    createdAt: r.created_at,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

export default router;

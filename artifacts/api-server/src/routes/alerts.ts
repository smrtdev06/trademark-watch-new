import { Router, type IRouter } from "express";
import { eq, sql, count, desc } from "drizzle-orm";
import { db, rawQuery, alertsTable, alertResultsTable, clientsTable, usersTable } from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";

const router: IRouter = Router();

router.get("/alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;
  const type = req.query.type as string;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;

  let where = isAdmin ? sql`1=1` : sql`a.user_id = ${userId}`;
  if (search) where = sql`${where} AND a.keyword ILIKE ${'%' + search + '%'}`;
  if (type) where = sql`${where} AND a.type = ${type}`;
  if (clientId) where = sql`${where} AND a.client_id = ${clientId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM alerts a WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT a.*, c.name as client_name
    FROM alerts a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE ${where}
    ORDER BY a.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const alerts = (data as any[]).map((r: any) => ({
    id: r.id, keyword: r.keyword, type: r.type, userId: r.user_id,
    clientId: r.client_id, clientName: r.client_name, country: r.country,
    class: r.class, freq: r.freq, nextCheckDate: r.next_check_date,
    businessTypeSpecific: r.business_type_specific,
    createdAt: r.created_at,
  }));

  res.json({ data: alerts, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/alerts", requireAuth, async (req, res): Promise<void> => {
  const { keyword, type, clientId, country, class: cls, businessTypeSpecific, freq } = req.body;
  if (!keyword || !type) {
    res.status(400).json({ status: 400, message: "keyword and type are required" });
    return;
  }
  await db.insert(alertsTable).values({
    keyword, type, clientId, country, class: cls,
    businessTypeSpecific, freq: freq || 1, userId: req.user!.id,
  });
  res.json({ status: 200, message: "Alert created" });
});

router.delete("/alerts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  if (isAdmin) {
    await db.delete(alertsTable).where(eq(alertsTable.id, id));
  } else {
    await db.delete(alertsTable).where(sql`id = ${id} AND user_id = ${req.user!.id}`);
  }
  res.json({ status: 200, message: "Alert deleted" });
});

router.get("/alerts/results", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const alertId = req.query.alertId ? parseInt(req.query.alertId as string) : null;
  const type = req.query.type as string;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;
  const keyword = req.query.keyword as string;

  let where = isAdmin ? sql`1=1` : sql`ar.user_id = ${userId}`;
  if (alertId) where = sql`${where} AND ar.alert_id = ${alertId}`;
  if (type) where = sql`${where} AND ar.type = ${type}`;
  if (clientId) where = sql`${where} AND ar.client_id = ${clientId}`;
  if (keyword) where = sql`${where} AND ar.keyword ILIKE ${'%' + keyword + '%'}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM alert_results ar WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT ar.*, c.name as client_name
    FROM alert_results ar
    LEFT JOIN clients c ON ar.client_id = c.id
    WHERE ${where}
    ORDER BY ar.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id, alertId: r.alert_id, keyword: r.keyword, type: r.type,
    name: r.name, address: r.address, recordId: r.record_id,
    result: r.result, clientName: r.client_name, createdAt: r.created_at,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/alerts/results/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_alert_results.xlsx" });
});

router.get("/alerts/filters", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const filter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;

  const typesRaw = await rawQuery(sql`SELECT DISTINCT type FROM alerts WHERE ${filter} ORDER BY type`);
  const keywordsRaw = await rawQuery(sql`SELECT DISTINCT keyword FROM alerts WHERE ${filter} ORDER BY keyword`);
  const clients = await db.select().from(clientsTable).where(filter);

  res.json({
    types: (typesRaw as any[]).map((r: any) => r.type),
    keywords: (keywordsRaw as any[]).map((r: any) => r.keyword),
    clients,
  });
});

export default router;

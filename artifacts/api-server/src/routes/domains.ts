import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db, rawQuery, domainsTable, domainResultsTable, clientsTable, usersTable } from "@workspace/db";
import { requireAuth, parseId } from "../lib/auth";
import { logger } from "../lib/logger";
import { domainMonitoringCheck } from "../cron/jobs/domainMonitoringCheck";

const router: IRouter = Router();

router.get("/domains", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;

  let where = isAdmin ? sql`1=1` : sql`d.user_id = ${userId}`;
  if (search) where = sql`${where} AND d.domain ILIKE ${'%' + search + '%'}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM domain_monitoring d WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT d.*, u.name as user_name, u.email as user_email, c.name as client_name
    FROM domain_monitoring d
    LEFT JOIN users u ON d.user_id = u.id
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE ${where}
    ORDER BY d.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const domains = (data as any[]).map((r: any) => ({
    id: r.id, domain: r.domain, searchType: r.search_type,
    userId: r.user_id, clientId: r.client_id,
    userName: r.user_name, userEmail: r.user_email,
    clientName: r.client_name,
    createdAt: r.created_at,
  }));

  res.json({ data: domains, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/domains", requireAuth, async (req, res): Promise<void> => {
  const { domain, searchType, clientId } = req.body;
  if (!domain || !searchType) {
    res.status(400).json({ status: 400, message: "domain and searchType are required" });
    return;
  }
  await db.insert(domainsTable).values({ domain, searchType, clientId, userId: req.user!.id });
  /** Cron `domain:monitoring:check` only runs daily at 10:00 — run once now so new rows get WHOIS hits without waiting */
  void domainMonitoringCheck().catch((err) =>
    logger.error({ err }, "domainMonitoringCheck after POST /domains failed"),
  );
  res.json({ status: 200, message: "Domain added" });
});

router.put("/domains/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  const { domain, searchType } = req.body;
  if (!domain) {
    res.status(400).json({ status: 400, message: "Domain is required" });
    return;
  }
  const where = isAdmin ? eq(domainsTable.id, id) : sql`id = ${id} AND user_id = ${req.user!.id}`;
  const result = await db
    .update(domainsTable)
    .set({ domain, searchType, status: 0 })
    .where(where);
  if ((result as any).rowCount === 0) {
    res.status(404).json({ status: 404, message: "Domain not found" });
    return;
  }
  void domainMonitoringCheck().catch((err) =>
    logger.error({ err }, "domainMonitoringCheck after PUT /domains failed"),
  );
  res.json({ status: 200, message: "Domain updated" });
});

router.delete("/domains/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const isAdmin = req.user!.role === "admin";
  if (isAdmin) {
    await db.delete(domainsTable).where(eq(domainsTable.id, id));
  } else {
    await db.delete(domainsTable).where(sql`id = ${id} AND user_id = ${req.user!.id}`);
  }
  res.json({ status: 200, message: "Domain deleted" });
});

router.get("/domains/results", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const domainId = req.query.domainId ? parseInt(req.query.domainId as string) : null;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;

  let where = isAdmin ? sql`1=1` : sql`dr.user_id = ${userId}`;
  if (domainId) where = sql`${where} AND dr.domain_monitoring_id = ${domainId}`;
  if (clientId) where = sql`${where} AND dr.client_id = ${clientId}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM domain_results dr WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT dr.*,
           dm.domain as monitoring_domain,
           dm.search_type as monitoring_search_type,
           c.name as client_name
    FROM domain_results dr
    LEFT JOIN domain_monitoring dm ON dm.id = dr.domain_monitoring_id
    LEFT JOIN clients c ON dr.client_id = c.id
    WHERE ${where}
    ORDER BY dr.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id,
    domainMonitoringId: r.domain_monitoring_id,
    /** Watch list term (from domain_monitoring), not the hit’s domain_name */
    domain: r.monitoring_domain ?? r.domain,
    domainName: r.domain_name,
    searchType: r.monitoring_search_type ?? r.search_type,
    result: r.result,
    registrationDate: r.registration_date,
    expiryDate: r.expiry_date,
    registrar: r.registrar,
    registrantName: r.registrant_name,
    registrantCountry: r.registrant_country,
    createDate: r.create_date,
    clientName: r.client_name,
    createdAt: r.created_at,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/domains/results/export", requireAuth, async (_req, res): Promise<void> => {
  res.json({ status: 200, file: "export_domain_results.xlsx" });
});

export default router;

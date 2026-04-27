import { Router, type IRouter } from "express";
import { sql, count, desc } from "drizzle-orm";
import { db, rawQuery, monitoringKeywordsTable, alertsTable, domainsTable, clientsTable, logoSearchesTable, socialKeywordsTable, activityLogsTable, monitoringResultsTable, alertResultsTable, domainResultsTable, socialResultsTable, logoResultsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const filter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;

  const kwResult = await db.select({ count: count() }).from(monitoringKeywordsTable).where(filter);
  const alertResult = await db.select({ count: count() }).from(alertsTable).where(filter);
  const domainResult = await db.select({ count: count() }).from(domainsTable).where(filter);
  const clientResult = await db.select({ count: count() }).from(clientsTable).where(filter);
  const logoResult = await db.select({ count: count() }).from(logoSearchesTable).where(filter);
  const socialResult = await db.select({ count: count() }).from(socialKeywordsTable).where(filter);

  let usersCount = 0;
  if (isAdmin) {
    const usersResult = await rawQuery(sql`SELECT count(*)::int as cnt FROM users WHERE deleted_at IS NULL`);
    usersCount = usersResult.length > 0 ? Number((usersResult[0] as any).cnt || 0) : 0;
  }

  res.json({
    usersCount,
    alertsCount: alertResult[0]?.count ?? 0,
    keywordsCount: kwResult[0]?.count ?? 0,
    clientsCount: clientResult[0]?.count ?? 0,
    logoCount: logoResult[0]?.count ?? 0,
    domainsCount: domainResult[0]?.count ?? 0,
    socialKeywordsCount: socialResult[0]?.count ?? 0,
    latestJournal: "",
    latestCountry: "",
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const filter = isAdmin ? sql`1=1` : sql`user_id = ${userId}`;

  const activities = await db.select().from(activityLogsTable).where(filter).orderBy(desc(activityLogsTable.createdAt)).limit(20);
  res.json(activities);
});

router.get("/dashboard/records-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  try {
    const userFilter = isAdmin ? sql`` : sql`WHERE user_id = ${userId}`;
    const rows = await rawQuery(sql`
      SELECT to_char(created_at::date, 'YYYY-MM-DD') as journal_date, count(*)::int as count
      FROM monitoring_results
      ${userFilter}
      GROUP BY created_at::date
      ORDER BY created_at::date ASC
      LIMIT 60
    `);

    const x = (rows as any[]).map((r: any) => r.journal_date);
    const y = (rows as any[]).map((r: any) => r.count);

    res.json({ x, y });
  } catch {
    res.json({ x: [], y: [] });
  }
});

export default router;

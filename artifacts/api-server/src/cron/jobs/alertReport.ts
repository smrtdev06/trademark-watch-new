import { db } from "@workspace/db";
import { alertResultsTable, alertsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function alertReport() {
  const today = new Date().toISOString().split("T")[0];

  const usersWithAlerts = await db.selectDistinct({ userId: alertsTable.userId })
    .from(alertResultsTable)
    .innerJoin(alertsTable, eq(alertsTable.id, alertResultsTable.alertId))
    .where(sql`alert_results.created_at::date = ${today}::date`);

  if (!usersWithAlerts.length) {
    logger.info("No alert results today, skipping report");
    return;
  }

  for (const { userId } of usersWithAlerts) {
    const results = await db.select({
      id: alertResultsTable.id,
      type: alertResultsTable.type,
      name: alertResultsTable.name,
      address: alertResultsTable.address,
      keyword: alertsTable.keyword,
      createdAt: alertResultsTable.createdAt,
    })
      .from(alertResultsTable)
      .innerJoin(alertsTable, eq(alertsTable.id, alertResultsTable.alertId))
      .where(and(
        eq(alertsTable.userId, userId),
        sql`alert_results.created_at::date = ${today}::date`
      ));

    if (!results.length) continue;

    const user = await db.select().from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user.length) continue;

    logger.info({
      userId,
      email: user[0].email,
      resultCount: results.length,
    }, "Alert report ready for user (email sending not configured)");
  }
}

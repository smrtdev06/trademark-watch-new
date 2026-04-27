import { db, rawQuery } from "@workspace/db";
import { domainsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { localCalendarYmd } from "../../lib/domainMonitoringDates";

/**
 * PHP `domain:monitoring:report` — email per user for today's results ({@link new-monitoring/app/Console/Commands/DomainMonitoringReport.php}).
 * Email/templates are not ported; we log payloads only.
 */
export async function domainMonitoringReport() {
  const unprocessed = await db.select().from(domainsTable)
    .where(eq(domainsTable.status, 0))
    .limit(1);

  if (unprocessed.length > 0) {
    logger.warn("Domain monitoring report skipped: there are still unprocessed entries");
    return;
  }

  /** PHP `Carbon::now()->format('Y-m-d')` for `whereDate('created_at', ...)` — use local calendar day, not UTC */
  const today = localCalendarYmd(new Date());
  const users = await db.select().from(usersTable);

  for (const user of users) {
    const results = await rawQuery(sql`
      SELECT dr.*, dm.domain as "sourceDomain", dm.search_type as "sourceSearchType"
      FROM domain_results dr
      INNER JOIN domain_monitoring dm ON dm.id = dr.domain_monitoring_id
      WHERE dr.user_id = ${user.id}
      AND dr.created_at::date = ${today}::date
      ORDER BY dr.id DESC
    `);

    if (!results.length) continue;

    logger.info({
      userId: user.id,
      email: user.email,
      resultCount: results.length,
    }, "Domain monitoring report ready for user (email sending not configured)");
  }
}

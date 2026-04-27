import { db, rawQuery } from "@workspace/db";
import { monitoringResultsTable, monitoringKeywordsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function monitoringReport() {
  const today = new Date().toISOString().split("T")[0];

  const users = await db.select().from(usersTable);

  if (!users.length) {
    logger.info("No users found for monitoring report");
    return;
  }

  for (const user of users) {
    const results = await rawQuery(sql`
      SELECT mr.*, mk.country as "countryCode", mk.keyword as "sourceKeyword",
             mk.class as "sourceClass"
      FROM monitoring_results mr
      INNER JOIN monitoring_keywords mk ON mk.id = mr.keyword_id
      WHERE mk.user_id = ${user.id}
      AND mr.created_at::date = ${today}::date
      ORDER BY mr.id DESC
    `);

    if (!results.length) continue;

    logger.info({
      userId: user.id,
      email: user.email,
      resultCount: results.length,
    }, "Monitoring report ready for user (email sending not configured)");
  }
}

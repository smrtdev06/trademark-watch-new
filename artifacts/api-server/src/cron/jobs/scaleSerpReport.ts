import { db, rawQuery } from "@workspace/db";
import { socialResultsTable, socialKeywordsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function scaleSerpReport() {
  const today = new Date().toISOString().split("T")[0];

  const usersWithResults = await rawQuery(sql`
    SELECT DISTINCT sr.user_id
    FROM social_results sr
    WHERE sr.created_at::date = ${today}::date
  `) as { user_id: number }[];

  if (!usersWithResults.length) {
    logger.info("No new social watch results today, skipping report");
    return;
  }

  for (const { user_id } of usersWithResults) {
    const results = await rawQuery(sql`
      SELECT sr.*, sk.keyword as "sourceKeyword", sk.site as "sourceSite"
      FROM social_results sr
      INNER JOIN social_keywords sk ON sk.id = sr.scale_serp_id
      WHERE sr.user_id = ${user_id}
      AND sr.created_at::date = ${today}::date
      ORDER BY sr.id DESC
    `);

    if (!results.length) continue;

    const user = await db.select().from(usersTable)
      .where(eq(usersTable.id, user_id))
      .limit(1);

    if (!user.length) continue;

    logger.info({
      userId: user_id,
      email: user[0].email,
      resultCount: results.length,
    }, "Social watch report ready for user (email sending not configured)");
  }
}

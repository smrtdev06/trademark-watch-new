/**
 * Mirrors PHP app/Console/Commands/ScaleSerpReport.php
 * Sends today's social watch results to each user that has new results.
 * Uses template group_id = 10 (ACTION_EMAIL_SCALE_SERP_REPORT).
 */

import { db, rawQuery } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail, getEmailTemplate, renderTemplate } from "../../lib/mailer";

const GROUP_ID = 10; // ACTION_EMAIL_SCALE_SERP_REPORT

function defaultHtml(user: { name: string }, results: any[]): string {
  const rows = results.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sourceKeyword ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sourceSite ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.name ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.social_link ?? ""}</td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:800px;margin:auto">
    <h2>Social Watch Report</h2>
    <p>Dear ${user.name},</p>
    <p>You have <strong>${results.length}</strong> new social watch result(s) today.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 10px;text-align:left">Keyword</th>
          <th style="padding:8px 10px;text-align:left">Site</th>
          <th style="padding:8px 10px;text-align:left">Name</th>
          <th style="padding:8px 10px;text-align:left">Link</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px">This is an automated report from the TM Monitoring Platform.</p>
  </div>`;
}

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

  const template = await getEmailTemplate(GROUP_ID);

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

    const users = await db.select().from(usersTable).where(eq(usersTable.id, user_id)).limit(1);
    if (!users.length) continue;
    const user = users[0];

    const subject = template ? renderTemplate(template.subject, { user, records: results }) : "Social Watch Report";
    const html = template
      ? renderTemplate(template.body, { user, records: results, count: results.length })
      : defaultHtml(user, results);

    await sendMail({ to: user.email, subject, html, userId: user.id });

    logger.info({ userId: user_id, email: user.email, resultCount: results.length }, "Social watch report sent");
  }
}

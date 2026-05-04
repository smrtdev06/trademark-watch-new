/**
 * Mirrors PHP app/Console/Commands/MonitoringReport.php
 * Sends today's TM Watch results to each user that has new results.
 * Uses template group_id = 1 (ACTION_MONITORING_REPORT).
 */

import { db, rawQuery } from "@workspace/db";
import { monitoringKeywordsTable, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail, getEmailTemplate, renderTemplate } from "../../lib/mailer";

const GROUP_ID = 1; // ACTION_MONITORING_REPORT

function defaultHtml(user: { name: string }, results: any[]): string {
  const rows = results.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sourceKeyword ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.appno ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.word_to_compare ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.countryCode ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.journal_date ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${(r.score ?? 0).toFixed(2)}</td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:800px;margin:auto">
    <h2>TM Watch Report</h2>
    <p>Dear ${user.name},</p>
    <p>You have <strong>${results.length}</strong> new TM Watch result(s) today.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 10px;text-align:left">Keyword</th>
          <th style="padding:8px 10px;text-align:left">App No</th>
          <th style="padding:8px 10px;text-align:left">Similar Word</th>
          <th style="padding:8px 10px;text-align:left">Country</th>
          <th style="padding:8px 10px;text-align:left">Journal Date</th>
          <th style="padding:8px 10px;text-align:left">Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px">This is an automated report from the TM Monitoring Platform.</p>
  </div>`;
}

export async function monitoringReport() {
  const today = new Date().toISOString().split("T")[0];
  const users = await db.select().from(usersTable);

  if (!users.length) {
    logger.info("No users found for monitoring report");
    return;
  }

  const template = await getEmailTemplate(GROUP_ID);

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

    const subject = template ? renderTemplate(template.subject, { user, records: results }) : "TM Watch Report";
    const html = template
      ? renderTemplate(template.body, { user, records: results, count: results.length })
      : defaultHtml(user, results);

    await sendMail({ to: user.email, subject, html, userId: user.id });

    logger.info({ userId: user.id, email: user.email, resultCount: results.length }, "Monitoring report sent");
  }
}

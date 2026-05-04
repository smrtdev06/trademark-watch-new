/**
 * Mirrors PHP app/Console/Commands/AlertReport.php
 * Sends today's alert results to each user that has new results.
 * Uses template group_id = 23 (ACTION_ALERT_REPORT).
 */

import { db } from "@workspace/db";
import { alertResultsTable, alertsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail, getEmailTemplate, renderTemplate } from "../../lib/mailer";

const GROUP_ID = 23; // ACTION_ALERT_REPORT

function defaultHtml(user: { name: string }, results: any[]): string {
  const rows = results.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.keyword ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.type ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.name ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.address ?? ""}</td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:800px;margin:auto">
    <h2>Alert Report</h2>
    <p>Dear ${user.name},</p>
    <p>You have <strong>${results.length}</strong> new alert result(s) today.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 10px;text-align:left">Keyword</th>
          <th style="padding:8px 10px;text-align:left">Type</th>
          <th style="padding:8px 10px;text-align:left">Name</th>
          <th style="padding:8px 10px;text-align:left">Address</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px">This is an automated report from the TM Monitoring Platform.</p>
  </div>`;
}

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

  const template = await getEmailTemplate(GROUP_ID);

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

    const users = await db.select().from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!users.length) continue;
    const user = users[0];

    const subject = template ? renderTemplate(template.subject, { user, records: results }) : "Alert Report";
    const html = template
      ? renderTemplate(template.body, { user, records: results, count: results.length })
      : defaultHtml(user, results);

    await sendMail({ to: user.email, subject, html, userId: user.id });

    logger.info({ userId, email: user.email, resultCount: results.length }, "Alert report sent");
  }
}

/**
 * Mirrors PHP app/Console/Commands/DomainMonitoringReport.php
 * Sends today's domain monitoring results to each user.
 * Uses template group_id = 6 (ACTION_NEW_DOMAIN_MONITORING).
 */

import { db, rawQuery } from "@workspace/db";
import { domainsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { localCalendarYmd } from "../../lib/domainMonitoringDates";
import { sendMail, sendErrorMail, getEmailTemplate, renderTemplate } from "../../lib/mailer";

const GROUP_ID = 6; // ACTION_NEW_DOMAIN_MONITORING

function defaultHtml(user: { name: string }, results: any[]): string {
  const rows = results.map((r) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sourceDomain ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.result ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sourceSearchType ?? ""}</td>
    </tr>`).join("");

  return `<div style="font-family:sans-serif;max-width:800px;margin:auto">
    <h2>Domain Monitoring Report</h2>
    <p>Dear ${user.name},</p>
    <p>You have <strong>${results.length}</strong> new domain monitoring result(s) today.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 10px;text-align:left">Domain</th>
          <th style="padding:8px 10px;text-align:left">Result</th>
          <th style="padding:8px 10px;text-align:left">Search Type</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;margin-top:20px">This is an automated report from the TM Monitoring Platform.</p>
  </div>`;
}

export async function domainMonitoringReport() {
  const unprocessed = await db.select().from(domainsTable)
    .where(eq(domainsTable.status, 0))
    .limit(1);

  if (unprocessed.length > 0) {
    logger.warn("Domain monitoring report skipped: there are still unprocessed entries");
    // Mirrors PHP: send error mail to admin
    await sendErrorMail(
      process.env.ADMIN_EMAIL ?? "",
      "Domain monitoring report",
      "Did not send because there are still unprocessed entries. Need to send it MANUALLY"
    );
    return;
  }

  const today = localCalendarYmd(new Date());
  const users = await db.select().from(usersTable);

  const template = await getEmailTemplate(GROUP_ID);

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

    const subject = template ? renderTemplate(template.subject, { user, records: results }) : "Domain Monitoring Report";
    const html = template
      ? renderTemplate(template.body, { user, records: results, count: results.length })
      : defaultHtml(user, results);

    await sendMail({ to: user.email, subject, html, userId: user.id });

    logger.info({ userId: user.id, email: user.email, resultCount: results.length }, "Domain monitoring report sent");
  }
}

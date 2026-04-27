/**
 * checkTrialPeriod
 *
 * Node.js port of Laravel `check:trial` console command
 * (new-monitoring/app/Console/Commands/CheckTrialPeriod.php).
 *
 * Finds user_products whose trial period ends TOMORROW (active_until = today+1)
 * and whose subscription is still unpaid (status = 0 / null / "").
 * Logs a warning for each such record.
 *
 * NOTE: The PHP implementation sends an email via WMNotification::mail().
 * Wire up your preferred email transport (e.g. nodemailer) where indicated below.
 */

import { rawQuery } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

interface TrialEndingRow {
  up_id: number;
  user_id: number;
  product_id: number;
  user_name: string;
  user_email: string;
  product_name: string;
  active_until: string;
}

export async function checkTrialPeriod(): Promise<void> {
  // tomorrow's date, start-of-day range
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // Mirrors PHP: status 0 | null | '' AND active_until = tomorrow
  const rows = await rawQuery<TrialEndingRow>(sql`
    SELECT
      up.id        AS up_id,
      up.user_id,
      up.product_id,
      u.name       AS user_name,
      u.email      AS user_email,
      p.name       AS product_name,
      up.active_until
    FROM user_products up
    JOIN users    u ON u.id = up.user_id
    JOIN products p ON p.id = up.product_id
    WHERE (up.status = '0' OR up.status IS NULL OR up.status = '')
      AND up.active_until >= ${tomorrow.toISOString()}
      AND up.active_until <  ${dayAfter.toISOString()}
  `);

  if (rows.length === 0) {
    logger.info("[checkTrialPeriod] No products with ending trial found");
    return;
  }

  logger.info({ count: rows.length }, "[checkTrialPeriod] Trial ending tomorrow for users");

  for (const row of rows) {
    logger.warn(
      {
        userId: row.user_id,
        userEmail: row.user_email,
        productName: row.product_name,
        activeUntil: row.active_until,
      },
      "[checkTrialPeriod] Trial period ends tomorrow – send notification email",
    );

    // TODO: replace the logger.warn above with your email transport, e.g.:
    //
    // await sendTrialEndingEmail({
    //   to: row.user_email,
    //   userName: row.user_name,
    //   productName: row.product_name,
    //   activeUntil: row.active_until,
    // });
  }
}

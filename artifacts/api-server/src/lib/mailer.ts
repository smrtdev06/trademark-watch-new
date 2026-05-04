/**
 * WMNotification equivalent — mirrors PHP app/Classes/WMNotification.php.
 *
 * - Reads SMTP config from the `settings` table first, then falls back to env vars.
 * - Sends HTML email via nodemailer (SwiftMailer equivalent).
 * - Logs every send attempt to `notification_logs` with status "sent" | "error".
 */

import nodemailer from "nodemailer";
import { db, settingsTable, notificationLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

/** Read from settings table, fall back to process.env[envKey] */
async function getSetting(name: string, envKey: string): Promise<string> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    if (row?.value?.trim()) return row.value.trim();
  } catch { /* fall through */ }
  return process.env[envKey] ?? "";
}

async function getSmtpConfig() {
  const host       = await getSetting("mail_host",       "MAIL_HOST");
  const portStr    = await getSetting("mail_port",       "MAIL_PORT");
  const encryption = await getSetting("mail_encryption", "MAIL_ENCRYPTION");
  const user       = await getSetting("mail_user_name",  "MAIL_USERNAME");
  const pass       = await getSetting("mail_password",   "MAIL_PASSWORD");
  const from       = await getSetting("from_address",    "MAIL_FROM_ADDRESS");
  const fromName   = await getSetting("from_name",       "MAIL_FROM_NAME");

  const port = parseInt(portStr || "587");

  return { host, port, encryption, user, pass, from, fromName };
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export interface MailOptions {
  /** Recipient email address */
  to: string;
  subject: string;
  html: string;
  /** Optional file attachment — mirrors PHP Swift_Attachment */
  attach?: { name: string; filePath: string };
  /** For notification_logs.user_id */
  userId?: number | null;
}

/**
 * Send an HTML email and log the result to notification_logs.
 * Mirrors PHP WMNotification::mail().
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  const { host, port, encryption, user, pass, from, fromName } = await getSmtpConfig();

  if (!host) {
    logger.warn({ to: opts.to }, "SMTP not configured — email not sent (set mail_host in Admin → Email Settings)");
    return;
  }

  // Create notification log before sending (mirrors PHP)
  let logId: number | undefined;
  try {
    const [log] = await db.insert(notificationLogsTable).values({
      type: "email",
      recipient: opts.to,
      subject: opts.subject,
      status: "pending",
      userId: opts.userId ?? null,
    }).returning({ id: notificationLogsTable.id });
    logId = log?.id;
  } catch (e) {
    logger.error({ e }, "Failed to create notification log");
  }

  try {
    const secure = encryption === "ssl";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    });

    const mailOpts: nodemailer.SendMailOptions = {
      from: fromName ? `"${fromName}" <${from}>` : from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    };

    if (opts.attach) {
      mailOpts.attachments = [{ filename: opts.attach.name, path: opts.attach.filePath }];
    }

    await transporter.sendMail(mailOpts);

    if (logId) {
      await db.update(notificationLogsTable)
        .set({ status: "sent" })
        .where(eq(notificationLogsTable.id, logId));
    }

    logger.info({ to: opts.to, subject: opts.subject }, "Email sent");
  } catch (err: any) {
    logger.error({ err, to: opts.to }, "Email send failed");
    if (logId) {
      await db.update(notificationLogsTable)
        .set({ status: "error" })
        .where(eq(notificationLogsTable.id, logId));
    }
  }
}

/**
 * Send an error/admin notification email (no logging).
 * Mirrors PHP WMNotification::errorMail().
 */
export async function sendErrorMail(to: string, subject: string, html: string): Promise<void> {
  const { host, port, encryption, user, pass, from, fromName } = await getSmtpConfig();
  if (!host) return;

  try {
    const transporter = nodemailer.createTransport({
      host, port,
      secure: encryption === "ssl",
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    });
    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to, subject, html,
    });
  } catch (err: any) {
    logger.error({ err }, "errorMail send failed");
  }
}

// ---------------------------------------------------------------------------
// Template renderer
// ---------------------------------------------------------------------------

/**
 * Simple mustache-style renderer: replaces {{key}} tokens.
 * Mirrors PHP DbView::make($template, $vars)->render().
 *
 * Supports dot-notation: {{user.name}} → vars.user.name
 * Supports {{#each records}}...{{/each}} loops (basic).
 */
export function renderTemplate(templateBody: string, vars: Record<string, any>): string {
  let out = templateBody;

  // Handle {{#each <key>}}...{{/each}} blocks
  out = out.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, key, inner) => {
    const list = vars[key];
    if (!Array.isArray(list)) return "";
    return list.map((item) => {
      return inner.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_m: string, path: string) => {
        return resolvePath(item, path) ?? "";
      });
    }).join("");
  });

  // Replace all remaining {{token}} placeholders
  out = out.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path) => {
    return String(resolvePath(vars, path) ?? "");
  });

  return out;
}

function resolvePath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

// ---------------------------------------------------------------------------
// Template fetcher (from DB)
// ---------------------------------------------------------------------------

import { templatesTable } from "@workspace/db";

/**
 * Fetch the active template for a given group_id.
 * Mirrors PHP: Action::with(['activeTemplate'])->where('id', ACTION_ID)->first()
 */
export async function getEmailTemplate(groupId: number): Promise<{ subject: string; body: string } | null> {
  const templates = await db.select()
    .from(templatesTable)
    .where(eq(templatesTable.groupId, groupId));

  if (!templates.length) return null;
  const active = templates.find((t) => t.active) ?? templates[0];
  return { subject: active.subject ?? "", body: active.body ?? "" };
}

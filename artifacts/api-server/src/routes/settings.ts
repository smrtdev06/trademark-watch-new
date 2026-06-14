import { Router, type IRouter } from "express";
import { eq, sql, count, desc } from "drizzle-orm";
import { db, rawQuery, settingsTable, rolesTable, userSettingsTable, templatesTable, notificationLogsTable, queryLogsTable, userStatsTable, usersTable, monitoringLatestTable } from "@workspace/db";
import { requireAuth, requireAdmin, parseId } from "../lib/auth";
import { monitoringGraphQlHeaders } from "../lib/graphqlMonitoringAuth";
import { getDefaultUserGroupId } from "../lib/subscriptionAccess";

const router: IRouter = Router();

router.get("/settings", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const settings = await db.select().from(settingsTable);
  res.json(settings);
});

router.put("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const items = req.body;
  if (Array.isArray(items)) {
    for (const item of items) {
      const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.name, item.name));
      if (existing) {
        await db.update(settingsTable).set({ value: item.value }).where(eq(settingsTable.id, existing.id));
      } else {
        await db.insert(settingsTable).values({ name: item.name, value: item.value });
      }
    }
  }
  res.json({ status: 200, message: "Settings updated" });
});

router.get("/settings/membership", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const defaultUserGroupId = await getDefaultUserGroupId();
  res.json({ defaultUserGroupId });
});

router.put("/settings/membership", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { defaultUserGroupId } = req.body as { defaultUserGroupId?: number | null };
  const value =
    defaultUserGroupId === null || defaultUserGroupId === undefined
      ? ""
      : String(defaultUserGroupId);

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.name, "default_user_group_id"));

  if (existing) {
    await db.update(settingsTable).set({ value }).where(eq(settingsTable.id, existing.id));
  } else {
    await db.insert(settingsTable).values({ name: "default_user_group_id", value });
  }

  res.json({ status: 200, message: "Membership settings updated", defaultUserGroupId: value ? Number(value) : null });
});

// ---------------------------------------------------------------------------
// Payment gateway settings — dedicated endpoints for structured read/write
// ---------------------------------------------------------------------------

const PAYMENT_SETTINGS = [
  "razorpay_key",
  "razorpay_secret",
  "paypal_mode",
  "paypal_sandbox_client_id",
  "paypal_sandbox_client_secret",
  "paypal_live_client_id",
  "paypal_live_client_secret",
];

/** Resolve: DB row → env var fallback.  Names map razor_key→RAZOR_KEY etc. */
async function resolvePaymentSetting(name: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
  if (row?.value && String(row.value).trim()) return String(row.value).trim();
  // env-var fallback: razorpay_key → RAZOR_KEY, paypal_mode → PAYPAL_MODE, etc.
  const envKey = name
    .replace(/^razorpay_key$/, "razor_key")
    .replace(/^razorpay_secret$/, "razor_secret")
    .toUpperCase();
  return process.env[envKey] ?? "";
}

function maskSecret(v: string): string {
  if (!v || v.length <= 6) return v ? "••••••" : "";
  return v.slice(0, 4) + "•".repeat(Math.min(v.length - 6, 20)) + v.slice(-2);
}

router.get("/settings/payment-gateways", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result: Record<string, string> = {};
  for (const name of PAYMENT_SETTINGS) {
    const raw = await resolvePaymentSetting(name);
    const isSecret = name.includes("secret");
    result[name] = isSecret ? maskSecret(raw) : raw;
  }
  res.json(result);
});

router.put("/settings/payment-gateways", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  for (const name of PAYMENT_SETTINGS) {
    const value = body[name];
    if (value === undefined) continue;
    // Skip saving if value looks like our mask (all bullets)
    if (/^[•]+$/.test(value.trim())) continue;
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    if (existing) {
      await db.update(settingsTable).set({ value }).where(eq(settingsTable.id, existing.id));
    } else {
      await db.insert(settingsTable).values({ name, value });
    }
  }
  res.json({ status: 200, message: "Payment gateway settings updated" });
});

router.get("/settings/roles", requireAuth, async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable);
  res.json(roles);
});

router.get("/settings/user-settings", requireAuth, async (req, res): Promise<void> => {
  const settings = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, req.user!.id));
  res.json(settings);
});

router.put("/settings/user-settings", requireAuth, async (req, res): Promise<void> => {
  const items = req.body;
  if (Array.isArray(items)) {
    for (const item of items) {
      const [existing] = await db.select().from(userSettingsTable).where(sql`user_id = ${req.user!.id} AND name = ${item.name}`);
      if (existing) {
        await db.update(userSettingsTable).set({ value: item.value }).where(eq(userSettingsTable.id, existing.id));
      } else {
        await db.insert(userSettingsTable).values({ userId: req.user!.id, name: item.name, value: item.value });
      }
    }
  }
  res.json({ status: 200, message: "User settings updated" });
});

router.get("/templates", requireAuth, async (_req, res): Promise<void> => {
  const templates = await db.select().from(templatesTable);
  res.json(templates);
});

router.get("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!template) {
    res.status(404).json({ status: 404, message: "Template not found" });
    return;
  }
  res.json(template);
});

router.put("/templates/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { subject, body, active } = req.body;
  const [template] = await db.update(templatesTable).set({ subject, body, active }).where(eq(templatesTable.id, id)).returning();
  if (!template) {
    res.status(404).json({ status: 404, message: "Template not found" });
    return;
  }
  res.json(template);
});

router.get("/reporting/logs", requireAuth, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const type = req.query.type as string;

  let where = sql`1=1`;
  if (type) where = sql`${where} AND type = ${type}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM notification_logs WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await db.select().from(notificationLogsTable).where(where).orderBy(desc(notificationLogsTable.createdAt)).limit(perPage).offset((page - 1) * perPage);
  res.json({ data, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.get("/reporting/query-logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM query_logs`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT ql.*, u.name as user_name
    FROM query_logs ql
    LEFT JOIN users u ON ql.user_id = u.id
    ORDER BY ql.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id, query: r.query, userId: r.user_id, userName: r.user_name,
    executionTime: r.execution_time, createdAt: r.created_at,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.get("/reporting/user-stats", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM user_stats`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await rawQuery(sql`
    SELECT us.*, u.name as user_name
    FROM user_stats us
    LEFT JOIN users u ON us.user_id = u.id
    ORDER BY us.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const results = (data as any[]).map((r: any) => ({
    id: r.id, userId: r.user_id, userName: r.user_name,
    screenSize: r.screen_size, lastLogin: r.last_login,
    loginCount: r.login_count,
  }));

  res.json({ data: results, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.get("/files", requireAuth, async (_req, res): Promise<void> => {
  res.json([]);
});

router.get("/files/:filename", requireAuth, async (req, res): Promise<void> => {
  res.status(404).json({ status: 404, message: "File not found" });
});

// ---------------------------------------------------------------------------
// SMTP / email settings (admin only) — mirrors PHP WMNotification + smtp.blade.php
// ---------------------------------------------------------------------------

const SMTP_SETTINGS = [
  "mail_host",
  "mail_port",
  "mail_encryption",
  "mail_user_name",
  "mail_password",
  "from_address",
  "from_name",
];

const SMTP_ENV_FALLBACKS: Record<string, string> = {
  mail_host: "MAIL_HOST",
  mail_port: "MAIL_PORT",
  mail_encryption: "MAIL_ENCRYPTION",
  mail_user_name: "MAIL_USERNAME",
  mail_password: "MAIL_PASSWORD",
  from_address: "MAIL_FROM_ADDRESS",
  from_name: "MAIL_FROM_NAME",
};

/** PHP .env files use "null" as a placeholder — treat it as empty */
function envSafe(val: string | undefined): string {
  if (!val || val.trim() === "null") return "";
  return val.trim();
}

router.get("/settings/smtp", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result: Record<string, string> = {};
  for (const name of SMTP_SETTINGS) {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    const dbVal = row?.value?.trim() ?? "";
    const envVal = envSafe(process.env[SMTP_ENV_FALLBACKS[name]]);
    const raw = dbVal || envVal;
    // Mask password but return a flag so the frontend knows it's set
    if (name === "mail_password") {
      result[name] = raw ? "••••••••" : "";
    } else {
      result[name] = raw;
    }
  }
  res.json(result);
});

router.put("/settings/smtp", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  for (const name of SMTP_SETTINGS) {
    const value = body[name];
    if (value === undefined) continue;
    if (/^[•]+$/.test(value.trim())) continue; // skip masked unchanged password
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    if (existing) {
      await db.update(settingsTable).set({ value }).where(eq(settingsTable.id, existing.id));
    } else {
      await db.insert(settingsTable).values({ name, value });
    }
  }
  res.json({ status: 200, message: "SMTP settings updated" });
});

router.post("/settings/smtp/test", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { to } = req.body as { to?: string };
  const recipient = to?.trim() || req.user!.email;

  // Resolve current SMTP config (same logic as lib/mailer.ts getSetting)
  async function resolve(name: string, envKey: string): Promise<string> {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    const dbVal = row?.value?.trim() ?? "";
    return dbVal || envSafe(process.env[envKey]);
  }

  const host       = await resolve("mail_host",       "MAIL_HOST");
  const portStr    = await resolve("mail_port",       "MAIL_PORT");
  const encryption = await resolve("mail_encryption", "MAIL_ENCRYPTION");
  const user       = await resolve("mail_user_name",  "MAIL_USERNAME");
  const pass       = await resolve("mail_password",   "MAIL_PASSWORD");
  const from       = await resolve("from_address",    "MAIL_FROM_ADDRESS");
  const fromName   = await resolve("from_name",       "MAIL_FROM_NAME");

  if (!host) {
    res.status(400).json({ status: 0, message: "SMTP host is not configured. Please fill in the settings above and save first." });
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const port = parseInt(portStr || "587");
    const secure = encryption === "ssl";

    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to: recipient,
      subject: "Test Email — TM Monitor SMTP",
      html: `<div style="font-family:sans-serif;max-width:500px;margin:auto">
        <h2>Test Email</h2>
        <p>This is a test email sent from the TM Monitor platform.</p>
        <p>If you received this, your SMTP settings are working correctly.</p>
        <hr/>
        <p style="color:#888;font-size:12px">Sent via: ${host}:${port} (${encryption || "none"})</p>
      </div>`,
    });

    res.json({ status: 1, message: `Test email sent to ${recipient}` });
  } catch (err: any) {
    res.status(502).json({ status: 0, message: err.message ?? "Failed to send test email" });
  }
});

// ---------------------------------------------------------------------------
// Debug routes (admin only) — mirrors PHP TestController
// ---------------------------------------------------------------------------

router.get("/debug/latest-journals", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(monitoringLatestTable).orderBy(desc(monitoringLatestTable.journalDate));
  res.json(rows);
});

router.post("/debug/keyword-test", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { keyword, countryCode, date } = req.body;
  const GRAPHQL_URL = process.env.GRAPHQL_MONITORING_URL ?? "https://trans.rasr.in/graphql";

  const query = `
    query ApplicationsQuery($keyword: String!, $countryCode: String, $journalDate: String, $offset: Int, $limit: Int) {
      applications: phoneticSearch(keyword: $keyword, countryCode: $countryCode, journalDate: $journalDate, offset: $offset, limit: $limit) {
        appId tmname translation transliteration date journalDate creationDate
        image compNameAndAddress reprName countryCode appClass
      }
    }
  `;

  try {
    const resp = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: monitoringGraphQlHeaders(),
      body: JSON.stringify({ query, variables: { keyword, countryCode: countryCode || null, journalDate: date || null, offset: 0, limit: 500 } }),
    });
    const data = await resp.json() as any;
    if (data?.errors) {
      res.status(502).json({ status: 0, message: data.errors[0]?.message ?? "GraphQL error" });
      return;
    }
    res.json({ status: 1, data: data?.data?.applications ?? [] });
  } catch (err: any) {
    res.status(502).json({ status: 0, message: err.message });
  }
});

export default router;

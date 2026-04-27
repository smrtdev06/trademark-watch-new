import { Router, type IRouter } from "express";
import { eq, sql, count, desc } from "drizzle-orm";
import { db, rawQuery, settingsTable, rolesTable, userSettingsTable, templatesTable, notificationLogsTable, queryLogsTable, userStatsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin, parseId } from "../lib/auth";

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

export default router;

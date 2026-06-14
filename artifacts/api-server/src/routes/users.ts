import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, sql, and, count } from "drizzle-orm";
import { db, rawQuery, usersTable, userProfilesTable, userLimitsTable, userStatsTable, monitoringKeywordsTable, alertsTable, domainsTable, logoSearchesTable, socialKeywordsTable, groupsTable, productsTable, userProductsTable } from "@workspace/db";
import { requireAuth, requireAdmin, parseId } from "../lib/auth";
import {
  activatedUserProductWhere,
  userHasActiveSubscription,
} from "../lib/subscriptionAccess";
import { COUNTRY_LIST_ALL, getCountryName } from "../lib/countryList";

function isAdminRole(role: string | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

const router: IRouter = Router();

router.get("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;
  const status = req.query.status as string;

  let where = sql`1=1`;
  if (search) {
    where = sql`${where} AND (name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})`;
  }
  if (status === "active") where = sql`${where} AND deleted_at IS NULL`;
  if (status === "suspended") where = sql`${where} AND deleted_at IS NOT NULL`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM users WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);
  const data = await rawQuery(sql`SELECT id, name, email, phone, role, group_id, email_verified_at, mobile_verified_at, created_at, deleted_at FROM users WHERE ${where} ORDER BY id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`);

  const users = (data as any[]).map((u: any) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, groupId: u.group_id,
    emailVerifiedAt: u.email_verified_at, mobileVerifiedAt: u.mobile_verified_at,
    createdAt: u.created_at, deletedAt: u.deleted_at,
  }));

  res.json({ data: users, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ status: 400, message: "Name, email, and password are required" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, password: hash, role: role || "user" }).returning();
  await db.insert(userProfilesTable).values({ userId: user.id });
  await db.insert(userStatsTable).values({ userId: user.id });
  res.json({ ...user, password: undefined });
});

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.user!.id));
  res.json(profile || { id: 0, userId: req.user!.id });
});

router.put("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { organization, address1, address2, city, pincode, country, gstNumber, organizationType, designation, companyName, address, pdfLogo } = req.body;
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (existing) {
    const [updated] = await db.update(userProfilesTable).set({ organization, address1, address2, city, pincode, country, gstNumber, organizationType, designation, companyName, address, pdfLogo }).where(eq(userProfilesTable.userId, userId)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(userProfilesTable).values({ userId, organization, address1, address2, city, pincode, country, gstNumber, organizationType, designation, companyName, address, pdfLogo }).returning();
    res.json(created);
  }
});

/** Parity with Laravel `UserController::allowedCountries` + `getAllowedCountries()`. */
router.get("/users/allowed-countries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  if (isAdminRole(req.user!.role)) {
    // Same payload as Laravel `CountryList::ALL` (not `LIST`).
    res.json(COUNTRY_LIST_ALL);
    return;
  }

  const rows = await rawQuery(
    sql`SELECT value::text AS code FROM user_limits WHERE user_id = ${userId} AND name = 'country'`,
  );
  const out: Record<string, string> = {};
  for (const r of rows as { code: string }[]) {
    const code = (r.code ?? "").trim();
    if (!code) continue;
    const name = getCountryName(code);
    if (name) out[code] = name;
  }
  res.json(out);
});

router.get("/users/my-limits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const limits = await db.select().from(userLimitsTable).where(eq(userLimitsTable.userId, userId));
  const [kwCount] = await db.select({ count: count() }).from(monitoringKeywordsTable).where(eq(monitoringKeywordsTable.userId, userId));
  const [alertCount] = await db.select({ count: count() }).from(alertsTable).where(eq(alertsTable.userId, userId));
  const [domainCount] = await db.select({ count: count() }).from(domainsTable).where(eq(domainsTable.userId, userId));
  const [logoCount] = await db.select({ count: count() }).from(logoSearchesTable).where(eq(logoSearchesTable.userId, userId));
  const [socialCount] = await db.select({ count: count() }).from(socialKeywordsTable).where(eq(socialKeywordsTable.userId, userId));

  res.json({
    limits: limits.map(l => ({ name: l.name, value: l.value })),
    used: [
      { name: "monitoring", value: kwCount.count },
      { name: "alert", value: alertCount.count },
      { name: "domain", value: domainCount.count },
      { name: "image", value: logoCount.count },
      { name: "social", value: socialCount.count },
    ],
  });
});

router.get("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ status: 404, message: "User not found" });
    return;
  }
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, id));
  res.json({ ...user, password: undefined, profile: profile || undefined });
});

router.put("/users/:id/group", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { groupId } = req.body as { groupId: number | null | undefined };
  if (groupId === null || groupId === undefined) {
    await db.update(usersTable).set({ groupId: null }).where(eq(usersTable.id, id));
  } else {
    if (typeof groupId !== "number" && typeof groupId !== "string") {
      res.status(400).json({ status: 400, message: "groupId must be a number or null" });
      return;
    }
    const gid = typeof groupId === "string" ? parseId(String(groupId)) : groupId;
    if (Number.isNaN(gid) || gid < 1) {
      res.status(400).json({ status: 400, message: "Invalid groupId" });
      return;
    }
    const [g] = await db.select().from(groupsTable).where(eq(groupsTable.id, gid));
    if (!g) {
      res.status(404).json({ status: 404, message: "Group not found" });
      return;
    }
    await db.update(usersTable).set({ groupId: gid }).where(eq(usersTable.id, id));
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ status: 404, message: "User not found" });
    return;
  }
  res.json({ ...user, password: undefined });
});

router.post("/users/:id/suspend", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.update(usersTable).set({ deletedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ status: 200, message: "User suspended" });
});

router.post("/users/:id/restore", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.update(usersTable).set({ deletedAt: null }).where(eq(usersTable.id, id));
  res.json({ status: 200, message: "User restored" });
});

/**
 * GET /users/:id/products
 * Returns all products assigned to a user (including trial/paid status).
 * Mirrors PHP `User::getAssignedProducts()`.
 */
router.get("/users/:id/products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const now = new Date();

  const rows = await rawQuery<{
    up_id: number;
    product_id: number;
    status: string | null;
    active_until: string | null;
    product_name: string;
  }>(sql`
    SELECT up.id AS up_id, up.product_id, up.status, up.active_until, p.name AS product_name
    FROM user_products up
    JOIN products p ON p.id = up.product_id
    WHERE up.user_id = ${id}
    ORDER BY up.id DESC
  `);

  const data = rows.map((r: (typeof rows)[0]) => {
    const activeUntil = r.active_until ? new Date(r.active_until) : null;
    const isPaid = r.status === "1" || r.status === "active";
    let displayStatus: string;
    if (isPaid) displayStatus = "active";
    else if (activeUntil && activeUntil >= now) displayStatus = "trial";
    else if (activeUntil && activeUntil < now) displayStatus = "trial_end";
    else displayStatus = "inactive";
    return { ...r, displayStatus, activeUntil: r.active_until };
  });

  res.json({ data });
});

/**
 * POST /users/:id/assign-products
 * Admin assigns products to a user.  If a product has `free_trial = true`, sets
 * `active_until = NOW + free_trial_days` (status stays "0" = trial).
 * Mirrors PHP `User::assignProducts()`.
 */
router.post("/users/:id/assign-products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { productIds } = req.body as { productIds: number[] };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ status: 400, message: "productIds array is required" });
    return;
  }

  const assigned: number[] = [];

  for (const productId of productIds) {
    // Skip if already assigned (mirrors PHP `if ($currProduct->count()) continue;`)
    const [existing] = await db.select().from(userProductsTable)
      .where(and(eq(userProductsTable.userId, id), eq(userProductsTable.productId, productId)));
    if (existing) continue;

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) continue;

    // Set trial active_until if free_trial is enabled
    const activeUntil: Date | null = product.freeTrial
      ? (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + (product.freeTrialDays ?? 0));
          return d;
        })()
      : null;

    await db.insert(userProductsTable).values({
      userId: id,
      productId,
      status: "0",
      activeUntil,
    });

    assigned.push(productId);
  }

  res.json({ status: 200, message: "Products assigned", assigned });
});

/**
 * DELETE /users/:id/products/:productId
 * Removes a product assignment from a user.
 * Mirrors PHP `User::removeAllProducts()` (single product variant).
 */
router.delete("/users/:id/products/:productId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = parseId(req.params.id);
  const productId = parseId(req.params.productId);

  await db.delete(userProductsTable)
    .where(and(eq(userProductsTable.userId, userId), eq(userProductsTable.productId, productId)));

  res.json({ status: 200, message: "Product removed from user" });
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await rawQuery(sql`DELETE FROM alerts WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM assessment_searches WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM domains WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM export_queue WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM logo_searches WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM monitoring_keywords WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM proprietor_searches WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM query_logs WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM social_keywords WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM user_limits WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM user_settings WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM client_contacts WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM user_profiles WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM user_stats WHERE user_id = ${id}`);
  await rawQuery(sql`DELETE FROM users WHERE id = ${id}`);
  res.json({ status: 200, message: "User deleted" });
});

router.get("/users/:id/limits", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const limits = await db.select().from(userLimitsTable).where(eq(userLimitsTable.userId, id));
  const [kwCount] = await db.select({ count: count() }).from(monitoringKeywordsTable).where(eq(monitoringKeywordsTable.userId, id));
  const [alertCount] = await db.select({ count: count() }).from(alertsTable).where(eq(alertsTable.userId, id));
  const [domainCount] = await db.select({ count: count() }).from(domainsTable).where(eq(domainsTable.userId, id));
  const [logoCount] = await db.select({ count: count() }).from(logoSearchesTable).where(eq(logoSearchesTable.userId, id));
  const [socialCount] = await db.select({ count: count() }).from(socialKeywordsTable).where(eq(socialKeywordsTable.userId, id));

  res.json({
    limits: limits.map(l => ({ name: l.name, value: l.value })),
    used: [
      { name: "monitoring", value: kwCount.count },
      { name: "alert", value: alertCount.count },
      { name: "domain", value: domainCount.count },
      { name: "image", value: logoCount.count },
      { name: "social", value: socialCount.count },
    ],
  });
});

router.put("/users/:id/limits", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, value } = req.body;
  const [existing] = await db.select().from(userLimitsTable).where(and(eq(userLimitsTable.userId, id), eq(userLimitsTable.name, name)));
  if (existing) {
    await db.update(userLimitsTable).set({ value }).where(eq(userLimitsTable.id, existing.id));
  } else {
    await db.insert(userLimitsTable).values({ userId: id, name, value });
  }
  res.json({ status: 200, message: "Limit updated" });
});

// ---------------------------------------------------------------------------
// GET /user/subscription-status
// Used by the frontend to block access when trial/subscription has expired.
// ---------------------------------------------------------------------------

router.get("/user/subscription-status", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role === "admin") {
    res.json({ hasActiveSubscription: true, status: "admin" });
    return;
  }

  const active = await userHasActiveSubscription(req.user!.id);
  res.json({
    hasActiveSubscription: active,
    status: active ? "active" : "expired",
  });
});

// ---------------------------------------------------------------------------
// GET /user/access
// Returns the list of product function IDs the current user may use.
// Mirrors PHP ProductPermissions::isFuncsAllowed() + UserProduct::scopeActivated().
//
// A user_product is "activated" when active_until >= now and status is paid or trial.
//
// Admins always receive the full function list.
// ---------------------------------------------------------------------------

const ALL_FUNCTIONS = [10, 20, 30, 40, 50, 60, 100, 110] as const;

router.get("/user/access", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role === "admin") {
    res.json({ allowedFunctions: [...ALL_FUNCTIONS] });
    return;
  }

  const userId = req.user!.id;

  // Fetch allowed_functions from every product the user has an activated subscription to.
  // Mirrors PHP: UserProduct::activated()->whereHas('product', status=1)->pluck('allowed_functions')
  const rows = await rawQuery<{ allowed_functions: string | number[] | null }>(sql`
    SELECT p.allowed_functions
    FROM user_products up
    JOIN products p ON p.id = up.product_id
    WHERE up.user_id = ${userId}
      AND p.status = 1
      AND ${activatedUserProductWhere}
  `);

  // Flatten + deduplicate all function IDs from every matching product
  const allowedFunctions: number[] = [];
  for (const row of rows) {
    let fns: number[] = [];
    if (Array.isArray(row.allowed_functions)) {
      fns = row.allowed_functions as number[];
    } else if (typeof row.allowed_functions === "string") {
      try { fns = JSON.parse(row.allowed_functions); } catch { /* ignore */ }
    }
    for (const fn of fns) {
      if (!allowedFunctions.includes(fn)) allowedFunctions.push(fn);
    }
  }

  res.json({ allowedFunctions });
});

export default router;

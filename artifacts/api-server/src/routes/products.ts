import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  rawQuery,
  productsTable,
  ordersTable,
  couponsTable,
  userProductsTable,
  userLimitsTable,
  settingsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, parseId } from "../lib/auth";
import { logger } from "../lib/logger";
import { assignUserToProductGroup } from "../lib/subscriptionAccess";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Payment-method constants (mirrors PHP Product::$paymentMethodRazorPay etc.)
// ---------------------------------------------------------------------------
const PAYMENT_RAZORPAY = 25;
const PAYMENT_PAYPAL = 15;

// ---------------------------------------------------------------------------
// Product function constants (mirrors PHP Product::function_*)
// ---------------------------------------------------------------------------
const FN_ALL_COUNTRIES_MONITORING = 10;
const FN_SPECIFIC_COUNTRIES_MONITORING = 20;
const FN_DOMAIN_MONITORING = 30;
const FN_ALL_COUNTRIES_VISUAL_SEARCH = 40;
const FN_SPECIFIC_COUNTRIES_VISUAL_SEARCH = 50;
const FN_ASSESSMENT = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns date = today + N days (start of day, no time component). */
function addDays(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Mirrors PHP `UserProduct::updateLimits()`.
 * Updates user_limits rows for the features included in the product.
 */
async function updateUserLimits(userId: number, product: {
  allowedFunctions: number[] | null;
  allowedAmountOfKeywords: number | null;
  allowedAmountOfDomains: number | null;
  allowedAmountOfAssessments: number | null;
  allowedAmountOfImageUploads: number | null;
}): Promise<void> {
  const fns: number[] = product.allowedFunctions ?? [];

  const upsertLimit = async (name: string, value: number) => {
    const [existing] = await db.select().from(userLimitsTable)
      .where(and(eq(userLimitsTable.userId, userId), eq(userLimitsTable.name, name)));
    if (existing) {
      await db.update(userLimitsTable).set({ value }).where(eq(userLimitsTable.id, existing.id));
    } else {
      await db.insert(userLimitsTable).values({ userId, name, value });
    }
  };

  const hasMonitoring = fns.includes(FN_ALL_COUNTRIES_MONITORING) || fns.includes(FN_SPECIFIC_COUNTRIES_MONITORING);
  if (hasMonitoring && product.allowedAmountOfKeywords) {
    await upsertLimit("monitoring", product.allowedAmountOfKeywords);
  }

  const hasDomain = fns.includes(FN_DOMAIN_MONITORING);
  if (hasDomain && product.allowedAmountOfDomains) {
    await upsertLimit("domain", product.allowedAmountOfDomains);
  }

  const hasAssessment = fns.includes(FN_ASSESSMENT);
  if (hasAssessment && product.allowedAmountOfAssessments) {
    await upsertLimit("assessment", product.allowedAmountOfAssessments);
  }

  const hasImage = fns.includes(FN_ALL_COUNTRIES_VISUAL_SEARCH) || fns.includes(FN_SPECIFIC_COUNTRIES_VISUAL_SEARCH);
  if (hasImage && product.allowedAmountOfImageUploads) {
    await upsertLimit("image", product.allowedAmountOfImageUploads);
  }
}

/**
 * Generates a Razorpay Payment Link via the REST API.
 * Mirrors PHP `Product::generateRazorPaymentLink()`.
 * Returns [paymentLinkId, paymentLinkUrl] or [null, null] on error.
 */
async function generateRazorPaymentLink(
  user: { name: string; email: string; phone?: string | null },
  totalAmount: number,
  currency: string,
  description: string | null,
): Promise<[string | null, string | null]> {
  const key = await getSettingValue("razorpay_key");
  const secret = await getSettingValue("razorpay_secret");
  const appUrl = process.env.APP_URL ?? "";

  if (!key || !secret) {
    logger.warn("Razorpay credentials not configured – skipping payment link");
    return [null, null];
  }

  try {
    const resp = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
      },
      body: JSON.stringify({
        amount: Math.round(totalAmount * 100),
        currency: currency || "INR",
        accept_partial: false,
        description: description ?? "",
        customer: { name: user.name, email: user.email, contact: user.phone ?? "" },
        notify: { sms: false, email: true },
        reminder_enable: true,
        callback_url: `${appUrl}/razor_payment_callback/`,
        callback_method: "get",
      }),
    });

    const data = await resp.json() as any;
    if (data?.id && data?.short_url) {
      return [data.id as string, data.short_url as string];
    }
    logger.error({ data }, "Razorpay payment link creation failed");
    return [null, null];
  } catch (err) {
    logger.error({ err }, "generateRazorPaymentLink error");
    return [null, null];
  }
}

/**
 * Verifies a Razorpay payment-link callback signature.
 * HMAC-SHA256 of `payment_link_id|payment_link_reference_id|payment_link_status|razorpay_payment_id`
 * keyed with RAZOR_SECRET.
 */
async function verifyRazorSignature(params: {
  razorpay_payment_link_id: string;
  razorpay_payment_link_reference_id: string;
  razorpay_payment_link_status: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<boolean> {
  const secret = await getSettingValue("razorpay_secret");
  if (!secret) return false;

  const message = [
    params.razorpay_payment_link_id,
    params.razorpay_payment_link_reference_id,
    params.razorpay_payment_link_status,
    params.razorpay_payment_id,
  ].join("|");

  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(params.razorpay_signature, "hex"));
}

// ---------------------------------------------------------------------------
// PayPal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Settings DB helper — DB value overrides .env so admins can configure
// payment gateway credentials without touching the server file system.
// ---------------------------------------------------------------------------

/**
 * Returns the value for `name` from the `settings` table.
 * Falls back to the corresponding env var:
 *   razorpay_key    → RAZOR_KEY
 *   razorpay_secret → RAZOR_SECRET
 *   everything else → NAME.toUpperCase()
 */
async function getSettingValue(name: string): Promise<string> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.name, name));
    if (row?.value && String(row.value).trim() !== "") return String(row.value).trim();
  } catch { /* fall through to env */ }
  const envKey = name
    .replace(/^razorpay_key$/, "razor_key")
    .replace(/^razorpay_secret$/, "razor_secret")
    .toUpperCase();
  return process.env[envKey] ?? "";
}

/**
 * Resolve PayPal base URL, client ID and secret.
 * Reads from the `settings` table first (admin-configurable), then falls back
 * to env vars, mirroring PHP config/paypal.php.
 */
async function getPayPalConfig(): Promise<{ base: string; clientId: string; secret: string }> {
  const mode = (await getSettingValue("paypal_mode")) || (process.env.PAYPAL_MODE ?? "sandbox");
  const isLive = mode === "live";

  const clientId = isLive
    ? ((await getSettingValue("paypal_live_client_id")) || (process.env.PAYPAL_LIVE_CLIENT_ID ?? ""))
    : ((await getSettingValue("paypal_sandbox_client_id")) || (process.env.PAYPAL_SANDBOX_CLIENT_ID ?? ""));

  const secret = isLive
    ? ((await getSettingValue("paypal_live_client_secret")) || (process.env.PAYPAL_LIVE_CLIENT_SECRET ?? ""))
    : ((await getSettingValue("paypal_sandbox_client_secret")) || (process.env.PAYPAL_SANDBOX_CLIENT_SECRET ?? ""));

  const base = process.env.PAYPAL_BASE_URL
    ?? (isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

  return { base, clientId, secret };
}

async function getPayPalAccessToken(): Promise<string | null> {
  const { base, clientId, secret } = await getPayPalConfig();

  if (!clientId || !secret) {
    logger.warn("PayPal credentials not configured (PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET or PAYPAL_LIVE_CLIENT_ID / PAYPAL_LIVE_CLIENT_SECRET)");
    return null;
  }

  try {
    const resp = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const data = await resp.json() as any;
    return (data?.access_token as string) ?? null;
  } catch (err) {
    logger.error({ err }, "getPayPalAccessToken error");
    return null;
  }
}

/**
 * Updates the remote PayPal product description and billing plan
 * (description, taxes, setup_fee) when a product is edited.
 * Mirrors PHP `ProductUpdatedEventListener::handle()`.
 */
async function updatePayPalProductAndPlan(product: {
  name: string | null;
  description: string | null;
  price: number;
  tax: number | null;
  transactionFee: number | null;
  paypalProductId: string | null;
  paypalPlanId: string | null;
}): Promise<void> {
  const { base } = await getPayPalConfig();
  const token = await getPayPalAccessToken();
  if (!token) return;

  try {
    // PATCH PayPal product — update description
    if (product.paypalProductId) {
      await fetch(`${base}/v1/catalogs/products/${product.paypalProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify([
          { op: "replace", path: "/description", value: product.description ?? "" },
        ]),
      });
    }

    // PATCH billing plan — description, taxes, setup_fee
    if (product.paypalPlanId) {
      const taxPct = product.tax ? (product.tax * 100) / product.price : 0;
      const setupFee = product.transactionFee
        ? (product.transactionFee * product.price) / 100
        : 0;

      await fetch(`${base}/v1/billing/plans/${product.paypalPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify([
          { op: "replace", path: "/description", value: `${product.name ?? ""} basic plan` },
          { op: "replace", path: "/taxes/percentage", value: String(taxPct) },
          {
            op: "replace",
            path: "/payment_preferences/setup_fee",
            value: { value: String(setupFee), currency_code: "USD" },
          },
        ]),
      });
    }
  } catch (err) {
    logger.error({ err }, "updatePayPalProductAndPlan error");
  }
}

/**
 * Creates a PayPal product + billing plan for a product.
 * Mirrors PHP `ProductCreatedEventListener::handle()`.
 */
async function createPayPalProductAndPlan(product: {
  id: number;
  name: string;
  description: string | null;
  price: number;
  status: number | null;
  freeTrial: boolean | null;
  freeTrialDays: number | null;
  daysValidAfterPayment: number | null;
  transactionFee: number | null;
  tax: number | null;
}): Promise<void> {
  const { base } = await getPayPalConfig();
  const token = await getPayPalAccessToken();
  if (!token) return;

  try {
    // Create PayPal product
    const productResp = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "PayPal-Request-Id": `create-product-${Date.now()}`,
      },
      body: JSON.stringify({
        name: product.name,
        description: product.description ?? "",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    const paypalProduct = await productResp.json() as any;
    if (!paypalProduct?.id) return;

    await db.update(productsTable)
      .set({ paypalProductId: paypalProduct.id as string })
      .where(eq(productsTable.id, product.id));

    // Build billing cycles (trial + regular)
    const billingCycles: object[] = [];

    if (product.freeTrial) {
      billingCycles.push({
        frequency: { interval_unit: "DAY", interval_count: 1 },
        tenure_type: "TRIAL",
        sequence: 1,
        total_cycles: product.freeTrialDays ?? 0,
      });
    }

    billingCycles.push({
      frequency: { interval_unit: "DAY", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: product.freeTrial ? 2 : 1,
      total_cycles: product.daysValidAfterPayment ?? 365,
      pricing_scheme: {
        fixed_price: { value: String(product.price), currency_code: "USD" },
      },
    });

    const setupFee = product.transactionFee
      ? (product.transactionFee * product.price) / 100
      : 0;
    const taxPct = product.tax
      ? (product.tax * 100) / product.price
      : 0;

    const planResp = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "PayPal-Request-Id": `create-plan-${Date.now()}`,
      },
      body: JSON.stringify({
        product_id: paypalProduct.id,
        name: `${product.name} plan`,
        description: `${product.name} basic plan`,
        status: product.status ? "ACTIVE" : "INACTIVE",
        billing_cycles: billingCycles,
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: String(setupFee), currency_code: "USD" },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: { percentage: String(taxPct), inclusive: false },
      }),
    });

    const plan = await planResp.json() as any;
    if (plan?.id) {
      await db.update(productsTable)
        .set({ paypalPlanId: plan.id as string })
        .where(eq(productsTable.id, product.id));
    }
  } catch (err) {
    logger.error({ err }, "createPayPalProductAndPlan error");
  }
}

// ---------------------------------------------------------------------------
// Product CRUD
// ---------------------------------------------------------------------------

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;
  const search = req.query.search as string;
  const isAdmin = req.user?.role === "admin";

  // Non-admin users only see active (status=1) products — mirrors PHP Product::scopeActive()
  let where = isAdmin ? sql`1=1` : sql`status = 1`;
  if (search) where = sql`${where} AND name ILIKE ${"%" + search + "%"}`;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM products WHERE ${where}`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await db.select().from(productsTable).where(where).orderBy(productsTable.id).limit(perPage).offset((page - 1) * perPage);

  res.json({ data, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

/** Admin: create product. If PayPal is an allowed payment method, creates PayPal product + plan. */
router.post("/products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [product] = await db.insert(productsTable).values(req.body).returning();

  const methods: number[] = product.allowedPaymentMethods ?? [];
  if (methods.includes(PAYMENT_PAYPAL)) {
    void createPayPalProductAndPlan(product);
  }

  res.json(product);
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ status: 404, message: "Product not found" });
    return;
  }
  res.json(product);
});

router.put("/products/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [product] = await db.update(productsTable).set(req.body).where(eq(productsTable.id, id)).returning();
  if (!product) {
    res.status(404).json({ status: 404, message: "Product not found" });
    return;
  }

  // Mirrors PHP ProductUpdatedEventListener: sync description/taxes/setup_fee with PayPal
  const methods: number[] = product.allowedPaymentMethods ?? [];
  if (methods.includes(PAYMENT_PAYPAL)) {
    void updatePayPalProductAndPlan(product);
  }

  res.json(product);
});

/**
 * Returns PayPal client ID + mode so the frontend can load the correct PayPal JS SDK.
 * Mirrors PHP config/paypal.php mode/client_id resolution.
 */
router.get("/paypal/config", requireAuth, async (_req, res): Promise<void> => {
  const { clientId, base } = await getPayPalConfig();
  const mode = base.includes("sandbox") ? "sandbox" : "live";
  res.json({ clientId, mode });
});

router.delete("/products/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ status: 200, message: "Product deleted" });
});

// ---------------------------------------------------------------------------
// Start free trial (no payment required).
// Activates a trial userProduct immediately: status='0', active_until=now+freeTrialDays.
// Mirrors PHP admin assign-products trial logic, but triggered by the user.
// ---------------------------------------------------------------------------

router.post("/products/:id/start-trial", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));

  if (!product) {
    res.status(404).json({ status: 404, message: "Product not found" });
    return;
  }

  if (!product.freeTrial) {
    res.status(400).json({ status: 400, message: "This product does not have a free trial" });
    return;
  }

  // Block if user already has a paid/active subscription
  const [existing] = await db.select().from(userProductsTable)
    .where(and(eq(userProductsTable.userId, req.user!.id), eq(userProductsTable.productId, product.id)));

  if (existing && (existing.status === "1" || existing.status === "active")) {
    res.status(400).json({ status: 400, message: "You already have an active subscription for this product" });
    return;
  }

  // If already in trial, just return success (idempotent)
  const now = new Date();
  if (existing && existing.activeUntil && existing.activeUntil >= now) {
    res.json({ status: 200, message: "Trial already active", userProduct: existing });
    return;
  }

  const activeUntil = addDays(product.freeTrialDays ?? 14);

  // Create a zero-value order for record-keeping
  const [order] = await db.insert(ordersTable).values({
    status: "trial",
    userId: req.user!.id,
    totalAmount: 0,
    subtotalAmount: product.price,
    totalTax: 0,
    totalDiscount: 0,
    productName: product.name,
    productId: product.id,
  }).returning();

  let userProduct;
  if (existing) {
    [userProduct] = await db.update(userProductsTable)
      .set({ status: "0", activeUntil, orderId: order.id, updatedAt: new Date() })
      .where(eq(userProductsTable.id, existing.id))
      .returning();
  } else {
    [userProduct] = await db.insert(userProductsTable).values({
      userId: req.user!.id,
      productId: product.id,
      orderId: order.id,
      status: "0",
      activeUntil,
    }).returning();
  }

  // Give the user their feature limits immediately during the trial
  await updateUserLimits(req.user!.id, product);

  res.json({ status: 200, message: "Free trial started", userProduct, order });
});

// ---------------------------------------------------------------------------
// Checkout
// Mirrors PHP `ProductController::checkout()`.
// Creates an order + user_products row (with Razorpay payment link if applicable).
// ---------------------------------------------------------------------------

router.post("/products/:id/checkout", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ status: 404, message: "Product not found" });
    return;
  }

  // Coupon discount
  let discount = 0;
  let couponId: number | null = null;
  const { couponCode, paymentMethod } = req.body || {};

  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode));
    if (!coupon) {
      res.status(400).json({ status: 0, message: "Could not find the coupon" });
      return;
    }
    discount = coupon.type === "percentage"
      ? product.price * (coupon.rate / 100)
      : coupon.rate;
    couponId = coupon.id;
  }

  // Price calculation (mirrors PHP ProductController::checkout)
  const subtotal = product.price;
  let totalAmount = subtotal - discount;

  let transactionFeeAmount = 0;
  if (product.transactionFee) {
    transactionFeeAmount = totalAmount * product.transactionFee / 100;
    totalAmount += transactionFeeAmount;
  }

  const taxAmount = product.tax ? product.price * product.tax / 100 : 0;
  totalAmount += taxAmount;

  // Create order
  const [order] = await db.insert(ordersTable).values({
    status: "awaiting_payment",
    userId: req.user!.id,
    couponId,
    totalAmount,
    subtotalAmount: subtotal,
    totalTax: taxAmount,
    totalDiscount: discount,
    productName: product.name,
    productId: product.id,
  }).returning();

  // Generate Razorpay payment link if Razorpay was chosen
  let razorPaymentId: string | null = null;
  let razorPaymentUrl: string | null = null;

  const allowedMethods: number[] = product.allowedPaymentMethods ?? [];
  if (allowedMethods.includes(PAYMENT_RAZORPAY) && paymentMethod === "razorpay") {
    [razorPaymentId, razorPaymentUrl] = await generateRazorPaymentLink(
      { name: req.user!.name, email: req.user!.email },
      totalAmount,
      product.currency ?? "INR",
      product.description,
    );

    if (!razorPaymentUrl) {
      // Roll back the order rather than leaving a dangling awaiting_payment record
      await db.update(ordersTable).set({ status: "payment_failed" }).where(eq(ordersTable.id, order.id));
      res.status(502).json({
        status: 502,
        message: "Razorpay payment link could not be created. Please check your Razorpay API keys in Admin → Settings or try again.",
      });
      return;
    }
  }

  // Upsert user_products (mirrors PHP updateOrCreate on user->products())
  const [existingUp] = await db.select().from(userProductsTable)
    .where(and(eq(userProductsTable.userId, req.user!.id), eq(userProductsTable.productId, product.id)));

  let userProduct;
  if (existingUp) {
    [userProduct] = await db.update(userProductsTable)
      .set({ razorPaymentId, razorPaymentUrl, orderId: order.id, updatedAt: new Date() })
      .where(eq(userProductsTable.id, existingUp.id))
      .returning();
  } else {
    [userProduct] = await db.insert(userProductsTable).values({
      userId: req.user!.id,
      productId: product.id,
      orderId: order.id,
      razorPaymentId,
      razorPaymentUrl,
      status: "0",
    }).returning();
  }

  res.json({
    status: 200,
    order,
    userProduct,
    paymentMethod: paymentMethod ?? null,
    razorPaymentUrl,
    paypalPlanId: allowedMethods.includes(PAYMENT_PAYPAL) ? product.paypalPlanId : null,
    // Needed by the PayPal JS SDK to override billing cycle price with the discounted amount
    subtotalAmount: subtotal - discount,
    currency: product.currency ?? "USD",
  });
});

// ---------------------------------------------------------------------------
// Razorpay payment callback (GET, no auth – called by Razorpay gateway).
// Mirrors PHP `BillingController::razorCallback()`.
// ---------------------------------------------------------------------------

router.get("/razor_payment_callback", async (req, res): Promise<void> => {
  const {
    razorpay_payment_link_id,
    razorpay_payment_id,
    razorpay_signature,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
  } = req.query as Record<string, string>;

  const frontendUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? "/";
  const invoicesUrl = `${frontendUrl}/billing/invoices`;

  const [userProduct] = await db.select().from(userProductsTable)
    .where(eq(userProductsTable.razorPaymentId, razorpay_payment_link_id));

  if (!userProduct) {
    res.redirect(`${invoicesUrl}?message=Order+not+found&status=0`);
    return;
  }

  // Save raw callback details to order
  if (userProduct.orderId) {
    await db.update(ordersTable)
      .set({ details: req.query as any })
      .where(eq(ordersTable.id, userProduct.orderId));
  }

  // Verify signature
  try {
    const valid = await verifyRazorSignature({
      razorpay_payment_link_id,
      razorpay_payment_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
    });
    if (!valid) throw new Error("Signature mismatch");
  } catch {
    if (userProduct.orderId) {
      await db.update(ordersTable).set({ status: "payment_failed" }).where(eq(ordersTable.id, userProduct.orderId));
    }
    res.redirect(`${invoicesUrl}?message=Invalid+signature&status=0`);
    return;
  }

  // Load product to get daysValidAfterPayment
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, userProduct.productId));

  // Activate subscription
  const activeUntil = addDays(product?.daysValidAfterPayment ?? 365);

  await db.update(userProductsTable)
    .set({ status: "1", activeUntil, updatedAt: new Date() })
    .where(eq(userProductsTable.id, userProduct.id));

  if (userProduct.orderId) {
    await db.update(ordersTable).set({ status: "payment_success" }).where(eq(ordersTable.id, userProduct.orderId));
  }

  // Update user limits
  if (product) {
    await updateUserLimits(userProduct.userId, product);
    await assignUserToProductGroup(userProduct.userId, product.groupId);
  }

  res.redirect(`${invoicesUrl}?message=Payment+status:+${razorpay_payment_link_status}&status=1`);
});

// ---------------------------------------------------------------------------
// PayPal subscription confirmation (POST, requires auth).
// Mirrors PHP `BillingController::savePaypalSubscription()`.
// ---------------------------------------------------------------------------

router.post("/billing/paypal-subscription", requireAuth, async (req, res): Promise<void> => {
  const { id, subscriptionId } = req.body as { id: number; subscriptionId: string };

  const [userProduct] = await db.select().from(userProductsTable)
    .where(and(eq(userProductsTable.id, id), eq(userProductsTable.userId, req.user!.id)));

  if (!userProduct) {
    res.status(404).json({ status: 0, message: "Order was not found" });
    return;
  }

  await db.update(userProductsTable)
    .set({ paypalSubscriptionId: subscriptionId, updatedAt: new Date() })
    .where(eq(userProductsTable.id, userProduct.id));

  // Verify subscription with PayPal
  const base = process.env.PAYPAL_BASE_URL ?? "https://api-m.paypal.com";
  const token = await getPayPalAccessToken();

  if (!token) {
    res.status(502).json({ status: 0, message: "PayPal not configured" });
    return;
  }

  try {
    const resp = await fetch(`${base}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const subscription = await resp.json() as any;

    // Save raw subscription to order
    if (userProduct.orderId) {
      await db.update(ordersTable)
        .set({ details: subscription })
        .where(eq(ordersTable.id, userProduct.orderId));
    }

    if (subscription?.status && String(subscription.status).toLowerCase() === "active") {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, userProduct.productId));
      const activeUntil = addDays(product?.daysValidAfterPayment ?? 365);

      await db.update(userProductsTable)
        .set({ status: "1", activeUntil, updatedAt: new Date() })
        .where(eq(userProductsTable.id, userProduct.id));

      if (userProduct.orderId) {
        await db.update(ordersTable).set({ status: "payment_success" }).where(eq(ordersTable.id, userProduct.orderId));
      }

      if (product) {
        await updateUserLimits(userProduct.userId, product);
        await assignUserToProductGroup(userProduct.userId, product.groupId);
      }

      res.json({ status: 200, message: "Payment confirmed", subscription });
    } else {
      if (userProduct.orderId) {
        await db.update(ordersTable).set({ status: "payment_failed" }).where(eq(ordersTable.id, userProduct.orderId));
      }
      res.json({ status: 0, message: "Subscription not active", subscription });
    }
  } catch (err) {
    logger.error({ err }, "PayPal subscription verification error");
    res.status(502).json({ status: 0, message: "PayPal verification failed" });
  }
});

// ---------------------------------------------------------------------------
// Billing invoices (user_products + status display).
// Mirrors PHP `Invoices::query()` + status badge logic.
// ---------------------------------------------------------------------------

router.get("/billing/invoices", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  const userWhere = isAdmin ? sql`1=1` : sql`up.user_id = ${userId}`;

  const totalRows = await rawQuery<{ count: string }>(
    sql`SELECT count(*) as count FROM user_products up WHERE ${userWhere}`,
  );
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await rawQuery<{
    id: number;
    user_id: number;
    product_id: number;
    order_id: number | null;
    status: string | null;
    active_until: string | null;
    razor_payment_url: string | null;
    paypal_plan_id: string | null;
    product_name: string | null;
    created_at: string;
  }>(sql`
    SELECT
      up.id,
      up.user_id,
      up.product_id,
      up.order_id,
      up.status,
      up.active_until,
      up.razor_payment_url,
      p.paypal_plan_id,
      p.name AS product_name,
      up.created_at
    FROM user_products up
    LEFT JOIN products p ON p.id = up.product_id
    WHERE ${userWhere}
    ORDER BY up.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const now = new Date();

  const data = rows.map((row: (typeof rows)[0]) => {
    const activeUntil = row.active_until ? new Date(row.active_until) : null;
    const isPaid = row.status === "1" || row.status === "active";
    const isTrialActive = !isPaid && activeUntil !== null && activeUntil >= now;
    const isTrialEnded = !isPaid && activeUntil !== null && activeUntil < now;

    let displayStatus: string;
    if (isTrialActive) displayStatus = "trial";
    else if (isTrialEnded) displayStatus = "trial_end";
    else if (isPaid) displayStatus = "active";
    else displayStatus = "inactive";

    const canPay = !isPaid || (activeUntil !== null && activeUntil <= now);

    return {
      ...row,
      displayStatus,
      canPay,
      activeUntil: row.active_until,
    };
  });

  res.json({ data, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

// ---------------------------------------------------------------------------
// Coupon apply
// ---------------------------------------------------------------------------

router.post("/products/apply-coupon", requireAuth, async (req, res): Promise<void> => {
  const { code, productId } = req.body;
  if (!code || !productId) {
    res.status(400).json({ status: 400, message: "code and productId are required" });
    return;
  }
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code));
  if (!coupon) {
    res.status(404).json({ status: 404, message: "Coupon not found" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ status: 404, message: "Product not found" });
    return;
  }

  const discount = coupon.type === "percentage" ? product.price * (coupon.rate / 100) : coupon.rate;
  const totalBeforeFee = product.price - discount;
  const fee = product.transactionFee ? totalBeforeFee * product.transactionFee / 100 : 0;
  const total = totalBeforeFee + fee + (product.tax ? product.price * product.tax / 100 : 0);

  res.json({
    status: 1,
    data: { totalDiscount: discount, totalAmount: total, transactionFee: fee },
  });
});

// ---------------------------------------------------------------------------
// Coupons admin
// ---------------------------------------------------------------------------

router.get("/coupons", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = 20;

  const totalRows = await rawQuery(sql`SELECT count(*) as count FROM coupons`);
  const total = Number(totalRows[0]?.count ?? 0);

  const data = await db.select().from(couponsTable).orderBy(couponsTable.id).limit(perPage).offset((page - 1) * perPage);
  res.json({ data, total, page, perPage, totalPages: Math.ceil(total / perPage) });
});

router.post("/coupons", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [coupon] = await db.insert(couponsTable).values(req.body).returning();
  res.json(coupon);
});

export default router;

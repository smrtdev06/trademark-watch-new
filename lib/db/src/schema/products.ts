import { pgTable, serial, text, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  currency: text("currency").default("INR"),
  status: integer("status").default(1),
  allowedFunctions: jsonb("allowed_functions").$type<number[]>(),
  allowedPaymentMethods: jsonb("allowed_payment_methods").$type<number[]>(),
  allowedCountries: jsonb("allowed_countries").$type<string[]>(),
  allowedAmountOfKeywords: integer("allowed_amount_of_keywords").default(0),
  allowedAmountOfDomains: integer("allowed_amount_of_domains").default(0),
  allowedAmountOfAssessments: integer("allowed_amount_of_assessments").default(0),
  allowedAmountOfImageUploads: integer("allowed_amount_of_image_uploads").default(0),
  tax: real("tax").default(0),
  transactionFee: real("transaction_fee").default(0),
  freeTrial: boolean("free_trial").default(false),
  freeTrialDays: integer("free_trial_days").default(0),
  daysValidAfterPayment: integer("days_valid_after_payment").default(365),
  /** User group assigned after successful payment for this product */
  groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "set null" }),
  /** PayPal catalog product ID created when product is saved with PayPal payment method */
  paypalProductId: text("paypal_product_id"),
  /** PayPal billing plan ID (with optional trial cycle) */
  paypalPlanId: text("paypal_plan_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Product = typeof productsTable.$inferSelect;

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  /** awaiting_payment | payment_success | payment_failed */
  status: text("status").notNull().default("awaiting_payment"),
  totalAmount: real("total_amount").notNull(),
  subtotalAmount: real("subtotal_amount"),
  totalTax: real("total_tax"),
  totalDiscount: real("total_discount"),
  couponId: integer("coupon_id"),
  productName: text("product_name"),
  /** Raw payment gateway callback/subscription payload */
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Order = typeof ordersTable.$inferSelect;

/**
 * Mirrors Laravel `user_products` table.
 * Tracks per-user product access: trial period, paid subscription, and payment gateway references.
 *
 * Status values:
 *   "0" (or null) = unpaid / trial
 *   "1"           = paid/active
 *
 * Trial active  : status="0"  AND activeUntil >= NOW
 * Trial ended   : status="0"  AND activeUntil < NOW
 * Paid active   : status="1"  AND activeUntil >= NOW
 * Inactive      : status="0"  AND activeUntil IS NULL
 */
export const userProductsTable = pgTable("user_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  status: text("status").default("0"),
  activeUntil: timestamp("active_until"),
  razorPaymentId: text("razor_payment_id"),
  razorPaymentUrl: text("razor_payment_url"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserProduct = typeof userProductsTable.$inferSelect;

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  rate: real("rate").notNull(),
  usages: integer("usages"),
  allProducts: boolean("all_products").default(true),
  allUsers: boolean("all_users").default(true),
  expiredAt: timestamp("expired_at"),
  productIds: jsonb("product_ids").$type<number[]>(),
  userIds: jsonb("user_ids").$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Coupon = typeof couponsTable.$inferSelect;

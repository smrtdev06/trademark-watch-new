import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupsTable } from "./groups";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("user"),
  groupId: integer("group_id").references(() => groupsTable.id, { onDelete: "set null" }),
  emailVerifiedAt: timestamp("email_verified_at"),
  mobileVerifiedAt: timestamp("mobile_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  organization: text("organization"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  pincode: text("pincode"),
  country: text("country"),
  gstNumber: text("gst_number"),
  organizationType: text("organization_type"),
  designation: text("designation"),
  companyName: text("company_name"),
  address: text("address"),
  pdfLogo: text("pdf_logo"),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;

export const userLimitsTable = pgTable("user_limits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  value: integer("value").notNull().default(0),
});

export type UserLimit = typeof userLimitsTable.$inferSelect;

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  value: text("value").notNull(),
});

export type UserSetting = typeof userSettingsTable.$inferSelect;

export const userStatsTable = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  screenSize: text("screen_size"),
  lastLogin: timestamp("last_login"),
  loginCount: integer("login_count").notNull().default(0),
});

export type UserStat = typeof userStatsTable.$inferSelect;

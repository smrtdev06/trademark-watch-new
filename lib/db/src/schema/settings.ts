import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: text("value").notNull(),
});

export type Setting = typeof settingsTable.$inferSelect;

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>(),
});

export type Role = typeof rolesTable.$inferSelect;

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body"),
  groupId: integer("group_id"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Template = typeof templatesTable.$inferSelect;

export const notificationLogsTable = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  status: text("status"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogsTable.$inferSelect;

export const queryLogsTable = pgTable("query_logs", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  userId: integer("user_id"),
  executionTime: integer("execution_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QueryLog = typeof queryLogsTable.$inferSelect;

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  userId: integer("user_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;

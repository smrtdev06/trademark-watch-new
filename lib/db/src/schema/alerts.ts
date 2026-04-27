import { pgTable, serial, text, timestamp, integer, jsonb, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  type: text("type").notNull(),
  country: text("country"),
  class: text("class"),
  freq: integer("freq").notNull().default(1),
  nextCheckDate: date("next_check_date"),
  businessTypeSpecific: jsonb("business_type_specific").$type<string[]>(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Alert = typeof alertsTable.$inferSelect;

export const alertResultsTable = pgTable("alert_results", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id),
  keyword: text("keyword"),
  type: text("type"),
  name: text("name"),
  address: text("address"),
  recordId: text("record_id"),
  result: jsonb("result"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AlertResult = typeof alertResultsTable.$inferSelect;

export const alertChangesTable = pgTable("alert_changes", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alertsTable.id),
  recordId: text("record_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AlertChange = typeof alertChangesTable.$inferSelect;

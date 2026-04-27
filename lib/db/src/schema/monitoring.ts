import { pgTable, serial, text, timestamp, integer, real, jsonb, date, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const monitoringKeywordsTable = pgTable("monitoring_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  country: text("country").notNull(),
  class: text("class").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MonitoringKeyword = typeof monitoringKeywordsTable.$inferSelect;

export const monitoringResultsTable = pgTable("monitoring_results", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => monitoringKeywordsTable.id),
  keyword: text("keyword").notNull(),
  wordToCompare: text("word_to_compare"),
  appno: text("appno").notNull(),
  journalDate: text("journal_date"),
  score: real("score"),
  conflictClass: text("conflict_class"),
  conflictCountry: text("conflict_country"),
  conflictStatus: text("conflict_status"),
  tmAppliedFor: text("tm_applied_for"),
  userDetail: text("user_detail"),
  country: text("country"),
  class: text("class"),
  journalCopyUrl: text("journal_copy_url"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  /** PHP `trademark_monitorings.favorite` — star on TM Watch */
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MonitoringResult = typeof monitoringResultsTable.$inferSelect;

export const monitoringScopesTable = pgTable("monitoring_scopes", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => monitoringKeywordsTable.id),
  keyword: text("keyword").notNull(),
  class: text("class"),
  wordToCompare: text("word_to_compare"),
  countryCode: text("country_code"),
  variables: jsonb("variables"),
  status: integer("status").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MonitoringScope = typeof monitoringScopesTable.$inferSelect;

export const monitoringLatestTable = pgTable("monitoring_latest", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull(),
  journalDate: date("journal_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MonitoringLatest = typeof monitoringLatestTable.$inferSelect;

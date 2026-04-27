import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const logoSearchesTable = pgTable("logo_searches", {
  id: serial("id").primaryKey(),
  file: text("file").notNull(),
  fileUrl: text("file_url"),
  status: text("status").default("pending"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LogoSearch = typeof logoSearchesTable.$inferSelect;

export const logoResultsTable = pgTable("logo_results", {
  id: serial("id").primaryKey(),
  logoSearchId: integer("logo_search_id").notNull().references(() => logoSearchesTable.id),
  matchScore: real("match_score"),
  imageUrl: text("image_url"),
  trademarkName: text("trademark_name"),
  appno: text("appno"),
  class: text("class"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LogoResult = typeof logoResultsTable.$inferSelect;

import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const socialKeywordsTable = pgTable("social_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  site: text("site").notNull(),
  mode: text("mode").default("exact"),
  freq: integer("freq").notNull().default(1),
  triggerAt: date("trigger_at"),
  category: text("category"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SocialKeyword = typeof socialKeywordsTable.$inferSelect;

export const socialResultsTable = pgTable("social_results", {
  id: serial("id").primaryKey(),
  scaleSerpId: integer("scale_serp_id").notNull().references(() => socialKeywordsTable.id),
  keyword: text("keyword"),
  site: text("site"),
  title: text("title"),
  link: text("link"),
  pageUrl: text("page_url"),
  snippet: text("snippet"),
  position: integer("position"),
  imageFile: text("image_file"),
  imageUrl: text("image_url"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SocialResult = typeof socialResultsTable.$inferSelect;

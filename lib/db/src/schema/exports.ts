import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const exportQueueTable = pgTable("export_queue", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  params: jsonb("params").$type<Record<string, any>>(),
  status: integer("status"),
  file: text("file"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExportQueue = typeof exportQueueTable.$inferSelect;

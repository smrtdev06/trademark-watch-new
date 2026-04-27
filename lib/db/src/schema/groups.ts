import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/** Maps menu keys (see monitoring Layout) to visible/hide. */
export const groupsTable = pgTable("user_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  menuPermissions: jsonb("menu_permissions")
    .$type<Record<string, boolean>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserGroup = typeof groupsTable.$inferSelect;

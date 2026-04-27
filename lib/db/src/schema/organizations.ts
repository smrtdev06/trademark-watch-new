import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organization = typeof organizationsTable.$inferSelect;

export const organizationMembersTable = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  head: boolean("head").default(false),
});

export type OrganizationMember = typeof organizationMembersTable.$inferSelect;

import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email1: text("email1"),
  email2: text("email2"),
  email3: text("email3"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  phone3: text("phone3"),
  address1: text("address1"),
  address2: text("address2"),
  address3: text("address3"),
  country: text("country"),
  city: text("city"),
  pincode: text("pincode"),
  clientType: text("client_type"),
  preferredContactType: text("preferred_contact_type"),
  allowControlPanel: boolean("allow_control_panel").default(false),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Client = typeof clientsTable.$inferSelect;

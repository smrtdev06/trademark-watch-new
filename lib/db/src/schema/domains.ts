import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const domainsTable = pgTable("domain_monitoring", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  searchType: text("search_type").notNull(),
  status: integer("status").notNull().default(0),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DomainMonitoring = typeof domainsTable.$inferSelect;

export const domainResultsTable = pgTable("domain_results", {
  id: serial("id").primaryKey(),
  domainMonitoringId: integer("domain_monitoring_id").notNull().references(() => domainsTable.id),
  domainName: text("domain_name"),
  registrantName: text("registrant_name"),
  registrantCountry: text("registrant_country"),
  createDate: text("create_date"),
  domain: text("domain"),
  searchType: text("search_type"),
  result: text("result"),
  registrationDate: text("registration_date"),
  expiryDate: text("expiry_date"),
  registrar: text("registrar"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DomainResult = typeof domainResultsTable.$inferSelect;

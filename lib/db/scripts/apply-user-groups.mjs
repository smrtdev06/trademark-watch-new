/**
 * Applies [migrations/001_user_groups.sql](../migrations/001_user_groups.sql) only.
 * Use when the API fails with missing column "group_id" (schema not yet migrated).
 * Safe to run more than once (IF NOT EXISTS / idempotent where supported).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "..");
const rootEnv = path.join(dbDir, "../..", ".env");

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    if (t.slice(0, i).trim() !== "DATABASE_URL") continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    databaseUrl = v;
    break;
  }
}
if (!databaseUrl) {
  console.error("DATABASE_URL is not set and could not be read from repo root .env");
  process.exit(1);
}

const sqlPath = path.join(dbDir, "migrations", "001_user_groups.sql");
const sql = readFileSync(sqlPath, "utf8");
const { Client } = pg;
const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query(sql);
  console.log("OK: applied", sqlPath);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import path from "path";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.join(thisDir, "../..", ".env");

/** So `pnpm run push` works without shell-export; matches repo root `.env` (same as API). */
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    if (key !== "DATABASE_URL") continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env.DATABASE_URL = val;
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned (or set in .env at repo root)");
}

export default defineConfig({
  /** Glob (relative to this config file) so drizzle-kit finds all table modules. */
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

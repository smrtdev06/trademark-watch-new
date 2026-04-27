import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

import type { SQL } from "drizzle-orm";
export async function rawQuery<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (result as any).rows ?? (Array.isArray(result) ? result : []);
}

export * from "./schema";

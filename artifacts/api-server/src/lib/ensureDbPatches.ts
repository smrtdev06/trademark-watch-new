import { pool } from "@workspace/db";
import { logger } from "./logger";

type PgErr = { code?: string };

async function tableExists(table: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return (r.rowCount ?? 0) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (r.rowCount ?? 0) > 0;
}

function isPermissionDenied(err: unknown): boolean {
  return (err as PgErr)?.code === "42501";
}

/**
 * Additive schema fixes for DBs created before a column existed in `migration.sql`.
 * Uses information_schema checks so we skip DDL when migration.sql already applied.
 */
export async function ensureMonitoringResultsFavoriteColumn(): Promise<void> {
  if (!(await tableExists("monitoring_results"))) {
    return;
  }
  if (await columnExists("monitoring_results", "favorite")) {
    return;
  }

  try {
    await pool.query(`
      ALTER TABLE monitoring_results
      ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE
    `);
  } catch (err) {
    if (isPermissionDenied(err)) {
      logger.warn(
        "Cannot add monitoring_results.favorite (not table owner). " +
          "Run as postgres: ALTER TABLE monitoring_results OWNER TO monitoring_user;",
      );
      return;
    }
    logger.error({ err }, "ensureMonitoringResultsFavoriteColumn failed");
    throw err;
  }
}

/**
 * Ensures the `user_products` table exists and products/orders have the PayPal
 * and details columns added in this sprint.  Mirrors the Laravel migrations:
 *   - 2022_03_07_103111_create_user_products_table
 *   - 2022_09_12_074313_add_order_to_user_products
 */
export async function ensureUserProductsTable(): Promise<void> {
  try {
    if (!(await tableExists("user_products"))) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_products (
          id              SERIAL PRIMARY KEY,
          user_id         INTEGER NOT NULL REFERENCES users(id),
          product_id      INTEGER NOT NULL REFERENCES products(id),
          order_id        INTEGER REFERENCES orders(id),
          status          VARCHAR(20) DEFAULT '0',
          active_until    TIMESTAMP,
          razor_payment_id   TEXT,
          razor_payment_url  TEXT,
          paypal_subscription_id TEXT,
          created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    if (await tableExists("products")) {
      if (!(await columnExists("products", "paypal_product_id"))) {
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS paypal_product_id TEXT`);
      }
      if (!(await columnExists("products", "paypal_plan_id"))) {
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT`);
      }
    }

    if (await tableExists("orders") && !(await columnExists("orders", "details"))) {
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS details JSONB`);
    }
  } catch (err) {
    if (isPermissionDenied(err)) {
      logger.warn(
        "Schema patch skipped (not table owner). " +
          "Re-run install.sh or as postgres: GRANT/ALTER OWNER on public tables to monitoring_user.",
      );
      return;
    }
    logger.error({ err }, "ensureUserProductsTable failed");
    throw err;
  }
}

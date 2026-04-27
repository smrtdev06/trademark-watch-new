import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Additive schema fixes for DBs created before a column existed in `migration.sql`.
 * Safe to run on every startup (`IF NOT EXISTS`).
 */
export async function ensureMonitoringResultsFavoriteColumn(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE monitoring_results
      ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE
    `);
  } catch (err) {
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

    await pool.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS paypal_product_id TEXT,
        ADD COLUMN IF NOT EXISTS paypal_plan_id    TEXT
    `);

    await pool.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS details JSONB
    `);

    // Change default status for orders to match awaiting_payment
    // (safe no-op if column already has correct default)
  } catch (err) {
    logger.error({ err }, "ensureUserProductsTable failed");
    throw err;
  }
}

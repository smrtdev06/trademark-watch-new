-- Incremental patch: subscription billing + product group assignment.
-- Idempotent — safe to run on every install and install-update.

BEGIN;

-- user_groups + users.group_id (no-op if migration.sql already applied)
CREATE TABLE IF NOT EXISTS user_groups (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  menu_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_group_id_user_groups_id_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_group_id_user_groups_id_fk
      FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- user_products (orders / billing)
CREATE TABLE IF NOT EXISTS user_products (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id),
  product_id             INTEGER NOT NULL REFERENCES products(id),
  order_id               INTEGER REFERENCES orders(id),
  status                 VARCHAR(20) DEFAULT '0',
  active_until           TIMESTAMP,
  razor_payment_id       TEXT,
  razor_payment_url      TEXT,
  paypal_subscription_id TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE user_products ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS razor_payment_id TEXT;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS razor_payment_url TEXT;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS active_until TIMESTAMP;
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- products: PayPal IDs + group assigned after successful payment
ALTER TABLE products ADD COLUMN IF NOT EXISTS paypal_product_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_group_id_user_groups_id_fk'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_group_id_user_groups_id_fk
      FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- orders: payment callback payload
ALTER TABLE orders ADD COLUMN IF NOT EXISTS details JSONB;

-- monitoring_results: favorites
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- settings key used by Admin → Settings → Membership (value set in UI)
INSERT INTO settings (name, value)
VALUES ('default_user_group_id', '')
ON CONFLICT (name) DO NOTHING;

COMMIT;

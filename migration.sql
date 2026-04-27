-- ============================================================
-- Trademark Monitoring Platform - PostgreSQL Database Migration
-- Generated from Drizzle ORM schema definitions
-- ============================================================
--
-- Run this file against a fresh PostgreSQL 14+ database:
--   psql -U your_user -d your_database -f migration.sql
-- ============================================================

BEGIN;

-- ========================
-- 1. USERS & PROFILES
-- ========================

CREATE TABLE IF NOT EXISTS user_groups (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  menu_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  password             TEXT NOT NULL,
  phone                TEXT,
  role                 TEXT NOT NULL DEFAULT 'user',
  group_id             INTEGER REFERENCES user_groups(id) ON DELETE SET NULL,
  email_verified_at    TIMESTAMP,
  mobile_verified_at   TIMESTAMP,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  organization      TEXT,
  address1          TEXT,
  address2          TEXT,
  city              TEXT,
  pincode           TEXT,
  country           TEXT,
  gst_number        TEXT,
  organization_type TEXT,
  designation       TEXT,
  company_name      TEXT,
  address           TEXT,
  pdf_logo          TEXT
);

CREATE TABLE IF NOT EXISTS user_limits (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name    TEXT NOT NULL,
  value   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_settings (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name    TEXT NOT NULL,
  value   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_stats (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  screen_size TEXT,
  last_login  TIMESTAMP,
  login_count INTEGER NOT NULL DEFAULT 0
);

-- ========================
-- 2. CLIENTS
-- ========================

CREATE TABLE IF NOT EXISTS clients (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT NOT NULL,
  email1                 TEXT,
  email2                 TEXT,
  email3                 TEXT,
  phone1                 TEXT,
  phone2                 TEXT,
  phone3                 TEXT,
  address1               TEXT,
  address2               TEXT,
  address3               TEXT,
  country                TEXT,
  city                   TEXT,
  pincode                TEXT,
  client_type            TEXT,
  preferred_contact_type TEXT,
  allow_control_panel    BOOLEAN DEFAULT FALSE,
  user_id                INTEGER NOT NULL REFERENCES users(id),
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 3. TM MONITORING
-- ========================

CREATE TABLE IF NOT EXISTS monitoring_keywords (
  id         SERIAL PRIMARY KEY,
  keyword    TEXT NOT NULL,
  country    TEXT NOT NULL,
  class      TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  client_id  INTEGER REFERENCES clients(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_results (
  id               SERIAL PRIMARY KEY,
  keyword_id       INTEGER NOT NULL REFERENCES monitoring_keywords(id),
  keyword          TEXT NOT NULL,
  word_to_compare  TEXT,
  appno            TEXT NOT NULL,
  journal_date     TEXT,
  score            REAL,
  conflict_class   TEXT,
  conflict_country TEXT,
  conflict_status  TEXT,
  tm_applied_for   TEXT,
  user_detail      TEXT,
  country          TEXT,
  class            TEXT,
  journal_copy_url TEXT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  client_id        INTEGER REFERENCES clients(id),
  favorite         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_scopes (
  id              SERIAL PRIMARY KEY,
  keyword_id      INTEGER NOT NULL REFERENCES monitoring_keywords(id),
  keyword         TEXT NOT NULL,
  class           TEXT,
  word_to_compare TEXT,
  country_code    TEXT,
  variables       JSONB,
  status          INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_latest (
  id           SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  journal_date DATE NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 4. ALERTS
-- ========================

CREATE TABLE IF NOT EXISTS alerts (
  id                     SERIAL PRIMARY KEY,
  keyword                TEXT NOT NULL,
  type                   TEXT NOT NULL,
  country                TEXT,
  class                  TEXT,
  freq                   INTEGER NOT NULL DEFAULT 1,
  next_check_date        DATE,
  business_type_specific JSONB,
  user_id                INTEGER NOT NULL REFERENCES users(id),
  client_id              INTEGER REFERENCES clients(id),
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_results (
  id         SERIAL PRIMARY KEY,
  alert_id   INTEGER NOT NULL REFERENCES alerts(id),
  keyword    TEXT,
  type       TEXT,
  name       TEXT,
  address    TEXT,
  record_id  TEXT,
  result     JSONB,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  client_id  INTEGER REFERENCES clients(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_changes (
  id         SERIAL PRIMARY KEY,
  alert_id   INTEGER NOT NULL REFERENCES alerts(id),
  record_id  TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 5. DOMAIN MONITORING
-- ========================

CREATE TABLE IF NOT EXISTS domain_monitoring (
  id          SERIAL PRIMARY KEY,
  domain      TEXT NOT NULL,
  search_type TEXT NOT NULL,
  status      INTEGER NOT NULL DEFAULT 0,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  client_id   INTEGER REFERENCES clients(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_results (
  id                    SERIAL PRIMARY KEY,
  domain_monitoring_id  INTEGER NOT NULL REFERENCES domain_monitoring(id),
  domain_name           TEXT,
  registrant_name       TEXT,
  registrant_country    TEXT,
  create_date           TEXT,
  domain                TEXT,
  search_type           TEXT,
  result                TEXT,
  registration_date     TEXT,
  expiry_date           TEXT,
  registrar             TEXT,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  client_id             INTEGER REFERENCES clients(id),
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 6. SOCIAL / SCALE-SERP WATCH
-- ========================

CREATE TABLE IF NOT EXISTS social_keywords (
  id         SERIAL PRIMARY KEY,
  keyword    TEXT NOT NULL,
  site       TEXT NOT NULL,
  mode       TEXT DEFAULT 'exact',
  freq       INTEGER NOT NULL DEFAULT 1,
  trigger_at DATE,
  category   TEXT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  client_id  INTEGER REFERENCES clients(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_results (
  id             SERIAL PRIMARY KEY,
  scale_serp_id  INTEGER NOT NULL REFERENCES social_keywords(id),
  keyword        TEXT,
  site           TEXT,
  title          TEXT,
  link           TEXT,
  page_url       TEXT,
  snippet        TEXT,
  position       INTEGER,
  image_file     TEXT,
  image_url      TEXT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  client_id      INTEGER REFERENCES clients(id),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 7. LOGO WATCH
-- ========================

CREATE TABLE IF NOT EXISTS logo_searches (
  id         SERIAL PRIMARY KEY,
  file       TEXT NOT NULL,
  file_url   TEXT,
  status     TEXT DEFAULT 'pending',
  user_id    INTEGER NOT NULL REFERENCES users(id),
  client_id  INTEGER REFERENCES clients(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logo_results (
  id              SERIAL PRIMARY KEY,
  logo_search_id  INTEGER NOT NULL REFERENCES logo_searches(id),
  match_score     REAL,
  image_url       TEXT,
  trademark_name  TEXT,
  appno           TEXT,
  class           TEXT,
  country         TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 8. PRODUCTS & ORDERS
-- ========================

CREATE TABLE IF NOT EXISTS products (
  id                           SERIAL PRIMARY KEY,
  name                         TEXT NOT NULL,
  description                  TEXT,
  price                        REAL NOT NULL,
  currency                     TEXT DEFAULT 'INR',
  status                       INTEGER DEFAULT 1,
  allowed_functions            JSONB,
  allowed_payment_methods      JSONB,
  allowed_countries            JSONB,
  allowed_amount_of_keywords   INTEGER DEFAULT 0,
  allowed_amount_of_domains    INTEGER DEFAULT 0,
  allowed_amount_of_assessments INTEGER DEFAULT 0,
  allowed_amount_of_image_uploads INTEGER DEFAULT 0,
  tax                          REAL DEFAULT 0,
  transaction_fee              REAL DEFAULT 0,
  free_trial                   BOOLEAN DEFAULT FALSE,
  free_trial_days              INTEGER DEFAULT 0,
  days_valid_after_payment     INTEGER DEFAULT 365,
  paypal_product_id            TEXT,
  paypal_plan_id               TEXT,
  created_at                   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL,
  rate         REAL NOT NULL,
  usages       INTEGER,
  all_products BOOLEAN DEFAULT TRUE,
  all_users    BOOLEAN DEFAULT TRUE,
  expired_at   TIMESTAMP,
  product_ids  JSONB,
  user_ids     JSONB,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  product_id       INTEGER REFERENCES products(id),
  -- awaiting_payment | payment_success | payment_failed
  status           TEXT NOT NULL DEFAULT 'awaiting_payment',
  total_amount     REAL NOT NULL,
  subtotal_amount  REAL,
  total_tax        REAL,
  total_discount   REAL,
  coupon_id        INTEGER,
  product_name     TEXT,
  details          JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_products (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id),
  product_id             INTEGER NOT NULL REFERENCES products(id),
  order_id               INTEGER REFERENCES orders(id),
  -- "0" = trial/unpaid  "1" = paid/active
  status                 VARCHAR(20) DEFAULT '0',
  active_until           TIMESTAMP,
  razor_payment_id       TEXT,
  razor_payment_url      TEXT,
  paypal_subscription_id TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 9. ORGANIZATIONS
-- ========================

CREATE TABLE IF NOT EXISTS organizations (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  head            BOOLEAN DEFAULT FALSE
);

-- ========================
-- 10. SETTINGS & SYSTEM
-- ========================

CREATE TABLE IF NOT EXISTS settings (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  permissions JSONB
);

CREATE TABLE IF NOT EXISTS templates (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  subject    TEXT,
  body       TEXT,
  group_id   INTEGER,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id         SERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  recipient  TEXT NOT NULL,
  subject    TEXT,
  status     TEXT,
  user_id    INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS query_logs (
  id             SERIAL PRIMARY KEY,
  query          TEXT NOT NULL,
  user_id        INTEGER,
  execution_time INTEGER,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id     INTEGER,
  metadata    JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 11. EXPORT QUEUE
-- ========================

CREATE TABLE IF NOT EXISTS export_queue (
  id         SERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  params     JSONB,
  status     INTEGER,
  file       TEXT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ========================
-- 12. SEED: Default admin user
-- ========================
-- Password: admin123 (bcrypt hash)

INSERT INTO users (name, email, password, role)
VALUES (
  'Admin User',
  'admin@monitoring.com',
  '$2b$10$nnH8icrjeMT9gCGxN74G/u04CXB9BeDfncl1qiR6v80LXzsARIZw6',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Default user limits for admin
INSERT INTO user_limits (user_id, name, value)
SELECT u.id, l.name, l.value
FROM users u
CROSS JOIN (VALUES
  ('alertLimits',      100),
  ('monitoringLimits', 100),
  ('domainLimits',     100),
  ('logoLimits',       100),
  ('socialLimits',     100),
  ('assessmentLimits', 100)
) AS l(name, value)
WHERE u.email = 'admin@monitoring.com'
ON CONFLICT DO NOTHING;

-- ========================
-- 13. INDEXES for performance
-- ========================

CREATE INDEX IF NOT EXISTS idx_users_group_id                    ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_keyword_id     ON monitoring_results(keyword_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_user_id        ON monitoring_results(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_created_at     ON monitoring_results(created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_scopes_status          ON monitoring_scopes(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_scopes_country_code    ON monitoring_scopes(country_code);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id                    ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_results_alert_id            ON alert_results(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_results_user_id             ON alert_results(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_monitoring_user_id         ON domain_monitoring(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_results_domain_monitoring_id ON domain_results(domain_monitoring_id);
CREATE INDEX IF NOT EXISTS idx_social_keywords_user_id           ON social_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_social_results_scale_serp_id      ON social_results(scale_serp_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id                   ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id                    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_user_id             ON user_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_product_id          ON user_products(product_id);
CREATE INDEX IF NOT EXISTS idx_export_queue_user_id              ON export_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at             ON query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at          ON activity_logs(created_at);

COMMIT;

-- ============================================================
-- Migration complete.
-- Default admin login: admin@monitoring.com / admin123
-- ============================================================

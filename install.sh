#!/bin/bash
set -euo pipefail

# ============================================================
# Trademark Monitoring Platform - Ubuntu Installation Script
# Tested on Ubuntu 22.04 LTS / 24.04 LTS
# Run as root or with sudo: sudo bash install.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE} $1${NC}"; echo -e "${BLUE}========================================${NC}"; }

if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo bash install.sh"
  exit 1
fi

# ============================================================
# CONFIGURATION - Edit these before running
# ============================================================

APP_DIR="/opt/monitoring"
APP_USER="monitoring"
DB_NAME="monitoring_db"
DB_USER="monitoring_user"
DB_PASS=""
SESSION_SECRET=""
API_PORT="5002"
WEB_PORT="5173"
NODE_VERSION="20"

FORBIDDEN_PORTS="80 8080 5000"

# ============================================================
# Interactive setup
# ============================================================

step "Trademark Monitoring Platform - Installer"

echo ""
read -rp "Installation directory [${APP_DIR}]: " input
APP_DIR="${input:-$APP_DIR}"

read -rp "System user to run the app [${APP_USER}]: " input
APP_USER="${input:-$APP_USER}"

read -rp "PostgreSQL database name [${DB_NAME}]: " input
DB_NAME="${input:-$DB_NAME}"

read -rp "PostgreSQL database user [${DB_USER}]: " input
DB_USER="${input:-$DB_USER}"

while [ -z "$DB_PASS" ]; do
  read -rsp "PostgreSQL database password (required): " DB_PASS
  echo ""
  if [ -z "$DB_PASS" ]; then
    err "Password cannot be empty"
  fi
done

read -rp "API port [${API_PORT}] (must not be 80, 8080, or 5000): " input
API_PORT="${input:-$API_PORT}"
read -rp "Web UI port [${WEB_PORT}] (must not be 80, 8080, or 5000): " input
WEB_PORT="${input:-$WEB_PORT}"

for p in $FORBIDDEN_PORTS; do
  if [ "$API_PORT" = "$p" ] || [ "$WEB_PORT" = "$p" ]; then
    err "Ports 80, 8080, and 5000 are not allowed. Choose other ports."
    exit 1
  fi
done

if [ "$API_PORT" = "$WEB_PORT" ]; then
  err "API port and web port must be different"
  exit 1
fi

SESSION_SECRET=$(openssl rand -hex 32)

echo ""
log "Configuration summary:"
echo "  App directory:   ${APP_DIR}"
echo "  App user:        ${APP_USER}"
echo "  Database:        ${DB_NAME}"
echo "  DB user:         ${DB_USER}"
echo "  API port:        ${API_PORT}"
echo "  Web UI port:     ${WEB_PORT}"
echo "  Reverse proxy:   none (PM2 + Vite preview only)"
echo ""
read -rp "Continue with installation? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# ============================================================
# 1. System packages
# ============================================================

step "1/10 - Updating system packages"

apt update && apt upgrade -y
apt install -y \
  curl wget git build-essential \
  postgresql postgresql-contrib \
  lsof ufw

log "System packages installed"

# ============================================================
# 2. Create app user
# ============================================================

step "2/10 - Creating application user"

if id "$APP_USER" &>/dev/null; then
  log "User '${APP_USER}' already exists"
else
  useradd -r -m -s /bin/bash "$APP_USER"
  log "Created user '${APP_USER}'"
fi

# ============================================================
# 3. Install Node.js
# ============================================================

step "3/10 - Installing Node.js ${NODE_VERSION}"

if command -v node &>/dev/null; then
  CURRENT_NODE=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
    log "Node.js $(node --version) already installed"
  else
    warn "Node.js v${CURRENT_NODE} found, upgrading to v${NODE_VERSION}"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt install -y nodejs
  fi
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt install -y nodejs
fi

log "Node.js $(node --version) ready"

# ============================================================
# 4. Install pnpm
# ============================================================

step "4/10 - Installing pnpm"

if command -v pnpm &>/dev/null; then
  log "pnpm $(pnpm --version) already installed"
else
  npm install -g pnpm@latest
  log "pnpm $(pnpm --version) installed"
fi

# ============================================================
# 5. Install PM2
# ============================================================

step "5/10 - Installing PM2"

if command -v pm2 &>/dev/null; then
  log "PM2 already installed"
else
  npm install -g pm2
  log "PM2 installed"
fi

# ============================================================
# 6. Setup PostgreSQL
# ============================================================

step "6/10 - Configuring PostgreSQL"

systemctl start postgresql
systemctl enable postgresql

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  log "Database user '${DB_USER}' already exists"
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  log "Created database user '${DB_USER}'"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  log "Database '${DB_NAME}' already exists"
else
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  log "Created database '${DB_NAME}'"
fi

sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

log "PostgreSQL configured"

# ============================================================
# 7. Copy project and install dependencies
# ============================================================

step "7/10 - Setting up application"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"

  log "Copying project files to ${APP_DIR}..."
  rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' \
    "${SCRIPT_DIR}/" "${APP_DIR}/"
fi

chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

cat > "${APP_DIR}/.env" <<ENVEOF
DATABASE_URL=${DATABASE_URL}
PORT=${API_PORT}
API_PORT=${API_PORT}
WEB_PORT=${WEB_PORT}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
LOG_LEVEL=info
ENVEOF

chmod 600 "${APP_DIR}/.env"
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"

log "Environment file created at ${APP_DIR}/.env"

log "Installing dependencies (this may take a few minutes)..."
su - "$APP_USER" -c "cd ${APP_DIR} && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"

log "Dependencies installed"

# ============================================================
# 8. Run database migration
# ============================================================

step "8/10 - Running database migration"

if [ -f "${APP_DIR}/migration.sql" ]; then
  PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -f "${APP_DIR}/migration.sql"
  log "Database migration complete"
else
  warn "migration.sql not found, using Drizzle push instead"
  su - "$APP_USER" -c "cd ${APP_DIR}/lib/db && DATABASE_URL='${DATABASE_URL}' pnpm run push"
  log "Drizzle schema push complete"
fi

# Tables created by postgres (manual migration) are not owned by the app user — fix that.
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQLEOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
DO \$\$ DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO ${DB_USER}', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ${DB_USER}', r.sequence_name);
  END LOOP;
END \$\$;
SQLEOF
log "Database ownership granted to ${DB_USER}"

# ============================================================
# 9. Build the project
# ============================================================

step "9/10 - Building the project"

su - "$APP_USER" -c "cd ${APP_DIR} && set -a && source .env && set +a && pnpm --filter @workspace/api-server run build"
if [ ! -f "${APP_DIR}/artifacts/api-server/dist/index.mjs" ]; then
  err "API build failed — missing ${APP_DIR}/artifacts/api-server/dist/index.mjs"
  exit 1
fi
log "API server built"

su - "$APP_USER" -c "cd ${APP_DIR} && BASE_PATH=/ pnpm --filter @workspace/monitoring run build"
log "Frontend built"

# ============================================================
# 10. PM2 — API + Vite preview (no Nginx)
# ============================================================

step "10/10 - Configuring PM2 (API + web, no Nginx)"

mkdir -p /var/log/monitoring
chown "${APP_USER}:${APP_USER}" /var/log/monitoring

cat > "${APP_DIR}/ecosystem.config.cjs" <<PM2EOF
module.exports = {
  apps: [
    {
      name: 'monitoring-api',
      cwd: '${APP_DIR}/artifacts/api-server',
      script: './dist/index.mjs',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '${API_PORT}',
        DATABASE_URL: '${DATABASE_URL}',
        SESSION_SECRET: '${SESSION_SECRET}',
        LOG_LEVEL: 'info',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/monitoring/api-error.log',
      out_file: '/var/log/monitoring/api-out.log',
      merge_logs: true,
    },
    {
      name: 'monitoring-web',
      cwd: '${APP_DIR}',
      script: 'pnpm',
      args: '--filter @workspace/monitoring run serve',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '${WEB_PORT}',
        API_PORT: '${API_PORT}',
        BASE_PATH: '/',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/monitoring/web-error.log',
      out_file: '/var/log/monitoring/web-out.log',
      merge_logs: true,
    },
  ],
};
PM2EOF

chown "${APP_USER}:${APP_USER}" "${APP_DIR}/ecosystem.config.cjs"

su - "$APP_USER" -c "pm2 delete monitoring-api monitoring-web 2>/dev/null || true"
su - "$APP_USER" -c "pm2 start ${APP_DIR}/ecosystem.config.cjs"
su - "$APP_USER" -c "pm2 save"

PM2_STARTUP=$(su - "$APP_USER" -c "pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}" 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP"
fi

log "PM2 configured — API on port ${API_PORT}, web on port ${WEB_PORT}"

# ============================================================
# Firewall
# ============================================================

ufw allow 22/tcp   >/dev/null 2>&1 || true
ufw allow "${API_PORT}"/tcp >/dev/null 2>&1 || true
ufw allow "${WEB_PORT}"/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# ============================================================
# Verification
# ============================================================

step "Verifying installation"

sleep 3

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}/api/healthz" 2>/dev/null || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/" 2>/dev/null || echo "000")

echo ""
if [ "$API_STATUS" = "200" ]; then
  log "API server:  OK (HTTP ${API_STATUS} on port ${API_PORT})"
else
  warn "API server:  HTTP ${API_STATUS} - check 'pm2 logs monitoring-api'"
fi

if [ "$WEB_STATUS" = "200" ]; then
  log "Web UI:      OK (HTTP ${WEB_STATUS} on port ${WEB_PORT})"
else
  warn "Web UI:      HTTP ${WEB_STATUS} - check 'pm2 logs monitoring-web'"
fi

DB_STATUS=$(PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT COUNT(*) FROM users" 2>/dev/null || echo "fail")
if [ "$DB_STATUS" != "fail" ]; then
  log "Database:    OK (${DB_STATUS} users found)"
else
  warn "Database:    Connection issue - check PostgreSQL logs"
fi

# ============================================================
# Done
# ============================================================

step "Installation Complete!"

echo ""
echo -e "${GREEN}Application URLs:${NC}"
IP=$(hostname -I | awk '{print $1}')
echo "  Web UI:  http://${IP}:${WEB_PORT}"
echo "  API:     http://${IP}:${API_PORT}/api/healthz"
echo ""
echo -e "${YELLOW}Open firewall ports ${WEB_PORT} and ${API_PORT} if accessing from another machine.${NC}"

echo ""
echo -e "${GREEN}Default admin login:${NC}"
echo "  Email:    admin@monitoring.com"
echo "  Password: admin123"

echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  pm2 status                      # Check API + web"
echo "  pm2 logs monitoring-api           # API logs"
echo "  pm2 logs monitoring-web           # Web logs"
echo "  pm2 restart all                   # Restart both"
echo "  cd ${APP_DIR} && npm run dev      # Dev mode (same ports via .env)"

echo ""
echo -e "${GREEN}File locations:${NC}"
echo "  Application:  ${APP_DIR}"
echo "  Environment:  ${APP_DIR}/.env"
echo "  Logs:         /var/log/monitoring/"
echo "  PM2 config:   ${APP_DIR}/ecosystem.config.cjs"

echo ""
echo -e "${YELLOW}IMPORTANT: Change the default admin password after first login!${NC}"
echo ""

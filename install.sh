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
DOMAIN=""
NODE_VERSION="20"
ENABLE_SSL="no"

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

read -rp "Domain name (leave empty for IP-only access): " DOMAIN

if [ -n "$DOMAIN" ]; then
  read -rp "Enable SSL with Let's Encrypt? (yes/no) [no]: " ENABLE_SSL
  ENABLE_SSL="${ENABLE_SSL:-no}"
fi

SESSION_SECRET=$(openssl rand -hex 32)

echo ""
log "Configuration summary:"
echo "  App directory:   ${APP_DIR}"
echo "  App user:        ${APP_USER}"
echo "  Database:        ${DB_NAME}"
echo "  DB user:         ${DB_USER}"
echo "  Domain:          ${DOMAIN:-<none, IP access>}"
echo "  SSL:             ${ENABLE_SSL}"
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
  nginx certbot python3-certbot-nginx \
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
PORT=8080
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

# ============================================================
# 9. Build the project
# ============================================================

step "9/10 - Building the project"

su - "$APP_USER" -c "cd ${APP_DIR} && set -a && source .env && set +a && pnpm --filter @workspace/api-server run build"
log "API server built"

su - "$APP_USER" -c "cd ${APP_DIR} && BASE_PATH=/ pnpm --filter @workspace/monitoring run build"
log "Frontend built"

# ============================================================
# 10. Configure Nginx
# ============================================================

step "10/10 - Configuring Nginx and PM2"

SERVER_NAME="${DOMAIN:-_}"

cat > /etc/nginx/sites-available/monitoring <<NGINXEOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${APP_DIR}/artifacts/monitoring/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
        proxy_read_timeout 120s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/monitoring /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

log "Nginx configured"

# ============================================================
# PM2 setup
# ============================================================

mkdir -p /var/log/monitoring
chown "${APP_USER}:${APP_USER}" /var/log/monitoring

cat > "${APP_DIR}/ecosystem.config.cjs" <<PM2EOF
module.exports = {
  apps: [{
    name: 'monitoring-api',
    cwd: '${APP_DIR}/artifacts/api-server',
    script: './dist/index.mjs',
    node_args: '--enable-source-maps',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
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
  }]
};
PM2EOF

chown "${APP_USER}:${APP_USER}" "${APP_DIR}/ecosystem.config.cjs"

su - "$APP_USER" -c "pm2 start ${APP_DIR}/ecosystem.config.cjs"
su - "$APP_USER" -c "pm2 save"

PM2_STARTUP=$(su - "$APP_USER" -c "pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}" 2>&1 | grep "sudo" | head -1)
if [ -n "$PM2_STARTUP" ]; then
  eval "$PM2_STARTUP"
fi

log "PM2 configured and API server started"

# ============================================================
# SSL (optional)
# ============================================================

if [ "$ENABLE_SSL" = "yes" ] && [ -n "$DOMAIN" ]; then
  step "Bonus - Setting up SSL"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || warn "SSL setup failed, you can run 'sudo certbot --nginx -d ${DOMAIN}' manually later"
fi

# ============================================================
# Firewall
# ============================================================

ufw allow 22/tcp   >/dev/null 2>&1 || true
ufw allow 80/tcp   >/dev/null 2>&1 || true
ufw allow 443/tcp  >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# ============================================================
# Verification
# ============================================================

step "Verifying installation"

sleep 3

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "000")
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")

echo ""
if [ "$API_STATUS" = "200" ]; then
  log "API server:  OK (HTTP ${API_STATUS})"
else
  warn "API server:  HTTP ${API_STATUS} - check 'pm2 logs monitoring-api'"
fi

if [ "$NGINX_STATUS" = "200" ]; then
  log "Nginx:       OK (HTTP ${NGINX_STATUS})"
else
  warn "Nginx:       HTTP ${NGINX_STATUS} - check 'sudo nginx -t' and 'sudo tail /var/log/nginx/error.log'"
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
echo -e "${GREEN}Application URL:${NC}"
if [ -n "$DOMAIN" ]; then
  if [ "$ENABLE_SSL" = "yes" ]; then
    echo "  https://${DOMAIN}"
  else
    echo "  http://${DOMAIN}"
  fi
else
  IP=$(hostname -I | awk '{print $1}')
  echo "  http://${IP}"
fi

echo ""
echo -e "${GREEN}Default admin login:${NC}"
echo "  Email:    admin@monitoring.com"
echo "  Password: admin123"

echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  pm2 status                      # Check API status"
echo "  pm2 logs monitoring-api         # View API logs"
echo "  pm2 restart monitoring-api      # Restart API"
echo "  sudo systemctl restart nginx    # Restart Nginx"
echo "  sudo nginx -t                   # Test Nginx config"
echo "  sudo certbot --nginx -d DOMAIN  # Add SSL later"

echo ""
echo -e "${GREEN}File locations:${NC}"
echo "  Application:  ${APP_DIR}"
echo "  Environment:  ${APP_DIR}/.env"
echo "  API logs:     /var/log/monitoring/"
echo "  Nginx config: /etc/nginx/sites-available/monitoring"
echo "  PM2 config:   ${APP_DIR}/ecosystem.config.cjs"

echo ""
echo -e "${YELLOW}IMPORTANT: Change the default admin password after first login!${NC}"
echo ""

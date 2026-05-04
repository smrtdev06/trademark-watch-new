#!/bin/bash
set -euo pipefail

# ============================================================
# Trademark Monitoring Platform - Build & Restart Script
# Use this for updates after the initial install.sh was run.
# Run as root or with sudo: sudo bash install-update.sh
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
  err "Please run as root: sudo bash install-update.sh"
  exit 1
fi

# ============================================================
# Config
# ============================================================

APP_DIR="/opt/monitoring"
APP_USER="monitoring"

read -rp "Application directory [${APP_DIR}]: " input
APP_DIR="${input:-$APP_DIR}"

read -rp "Application user [${APP_USER}]: " input
APP_USER="${input:-$APP_USER}"

if [ ! -f "${APP_DIR}/.env" ]; then
  err ".env not found at ${APP_DIR}/.env — run install.sh first."
  exit 1
fi

log "Using app dir: ${APP_DIR}"
log "Using app user: ${APP_USER}"

# ============================================================
# 1. Build API server
# ============================================================

step "1/3 - Building API server"

su - "$APP_USER" -c "cd ${APP_DIR} && set -a && source .env && set +a && pnpm --filter @workspace/api-server run build"
log "API server built"

# ============================================================
# 2. Build frontend
# ============================================================

step "2/3 - Building frontend"

su - "$APP_USER" -c "cd ${APP_DIR} && BASE_PATH=/ pnpm --filter @workspace/monitoring run build"
log "Frontend built"

# Fix permissions so Nginx (www-data) can read the output
chmod -R o+rX "${APP_DIR}/artifacts/monitoring/dist"
chmod o+x "${APP_DIR}" "${APP_DIR}/artifacts" "${APP_DIR}/artifacts/monitoring"

log "Permissions fixed"

# ============================================================
# 3. Restart services
# ============================================================

step "3/3 - Restarting services"

# Restart API via PM2
if su - "$APP_USER" -c "pm2 list" 2>/dev/null | grep -q "monitoring-api"; then
  su - "$APP_USER" -c "pm2 restart monitoring-api"
  log "PM2 process restarted"
else
  warn "monitoring-api not found in PM2 — starting it now"
  if [ -f "${APP_DIR}/ecosystem.config.cjs" ]; then
    su - "$APP_USER" -c "pm2 start ${APP_DIR}/ecosystem.config.cjs"
    su - "$APP_USER" -c "pm2 save"
    log "PM2 process started"
  else
    err "ecosystem.config.cjs not found — run install.sh first."
    exit 1
  fi
fi

# Reload Nginx to pick up any new static assets
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  log "Nginx reloaded"
else
  warn "Nginx is not running"
fi

# ============================================================
# Verify
# ============================================================

sleep 2

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "000")
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")

echo ""
if [ "$API_STATUS" = "200" ]; then
  log "API server:  OK (HTTP ${API_STATUS})"
else
  warn "API server:  HTTP ${API_STATUS} — check: pm2 logs monitoring-api"
fi

if [ "$NGINX_STATUS" = "200" ]; then
  log "Nginx:       OK (HTTP ${NGINX_STATUS})"
else
  warn "Nginx:       HTTP ${NGINX_STATUS} — check: sudo nginx -t"
fi

echo ""
log "Update complete!"
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  pm2 status                  # Check API status"
echo "  pm2 logs monitoring-api     # View API logs"
echo "  pm2 restart monitoring-api  # Restart API manually"
echo "  sudo systemctl reload nginx # Reload Nginx manually"
echo ""

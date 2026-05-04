#!/bin/bash
set -euo pipefail

# ============================================================
# Trademark Monitoring Platform - Build & Restart Script
# Use this for updates after the initial install.sh was run.
# Run as root or with sudo: sudo bash install-update.sh
#
# Supports two layouts:
#   A) Source and app dir are the same  (/opt/monitoring)
#   B) Source is in a different location (/root/trademark-watch-new)
#      while Nginx/PM2 serve from /opt/monitoring
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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"          # where the git repo / source code lives
APP_DIR="/opt/monitoring"         # where Nginx + PM2 serve from
APP_USER="monitoring"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} TM Monitor — Build & Restart${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

read -rp "Source directory (git repo location) [${SOURCE_DIR}]: " input
SOURCE_DIR="${input:-$SOURCE_DIR}"

read -rp "App/deploy directory (Nginx root, PM2 cwd) [${APP_DIR}]: " input
APP_DIR="${input:-$APP_DIR}"

read -rp "Application user (runs PM2) [${APP_USER}]: " input
APP_USER="${input:-$APP_USER}"

# Validate
if [ ! -f "${APP_DIR}/.env" ]; then
  err ".env not found at ${APP_DIR}/.env — is this the right app directory?"
  err "If you haven't run install.sh yet, do that first."
  exit 1
fi

if [ ! -f "${SOURCE_DIR}/package.json" ]; then
  err "package.json not found in source dir: ${SOURCE_DIR}"
  exit 1
fi

log "Source dir : ${SOURCE_DIR}"
log "App dir    : ${APP_DIR}"
log "App user   : ${APP_USER}"

SAME_DIR=false
if [ "$SOURCE_DIR" = "$APP_DIR" ]; then
  SAME_DIR=true
  log "Source and app dir are the same — no sync needed"
fi

# ============================================================
# 1. Sync source files to app dir (if different)
# ============================================================

if [ "$SAME_DIR" = false ]; then
  step "1/4 - Syncing source files to app dir"

  rsync -a \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='artifacts/api-server/dist' \
    --exclude='artifacts/monitoring/dist' \
    --exclude='.env' \
    "${SOURCE_DIR}/" "${APP_DIR}/"

  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  log "Files synced to ${APP_DIR}"
else
  step "1/4 - Skipping sync (same directory)"
fi

# ============================================================
# 2. Install dependencies
# ============================================================

step "2/4 - Installing dependencies"

su - "$APP_USER" -c "cd ${APP_DIR} && pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
log "Dependencies installed"

# ============================================================
# 3. Build API server (renumbered)
# ============================================================

step "3/5 - Building API server"

su - "$APP_USER" -c "cd ${APP_DIR} && set -a && source .env && set +a && pnpm --filter @workspace/api-server run build"
log "API server built"

# ============================================================
# 3. Build frontend
# ============================================================

step "4/5 - Building frontend"

su - "$APP_USER" -c "cd ${APP_DIR} && BASE_PATH=/ pnpm --filter @workspace/monitoring run build"
log "Frontend built"

# Fix permissions so Nginx (www-data) can read the output
chmod -R o+rX "${APP_DIR}/artifacts/monitoring/dist"
chmod o+x "${APP_DIR}" "${APP_DIR}/artifacts" "${APP_DIR}/artifacts/monitoring"
log "Permissions fixed"

# ============================================================
# 4. Restart services
# ============================================================

step "5/5 - Restarting services"

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
    err "ecosystem.config.cjs not found at ${APP_DIR} — run install.sh first."
    exit 1
  fi
fi

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

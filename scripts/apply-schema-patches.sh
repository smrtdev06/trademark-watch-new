#!/bin/bash
# Apply lib/db/migrations/*.sql in order (idempotent patches for existing DBs).
#
# Usage:
#   apply-schema-patches.sh APP_DIR [DB_USER DB_PASS DB_NAME]
#   apply-schema-patches.sh APP_DIR --superuser
#
# --superuser  Run as local postgres OS user (recommended for install-update on
#              servers where tables were created by postgres).

set -euo pipefail

APP_DIR="${1:?Usage: apply-schema-patches.sh APP_DIR [DB_USER DB_PASS DB_NAME | --superuser]}"
PATCH_DIR="${APP_DIR}/lib/db/migrations"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

if [ ! -d "$PATCH_DIR" ]; then
  warn "No schema patches directory: ${PATCH_DIR}"
  exit 0
fi

mapfile -t PATCH_FILES < <(find "$PATCH_DIR" -maxdepth 1 -name '[0-9]*.sql' | sort)

if [ "${#PATCH_FILES[@]}" -eq 0 ]; then
  warn "No numbered SQL patches found in ${PATCH_DIR}"
  exit 0
fi

run_file() {
  local file="$1"
  shift
  log "Applying $(basename "$file")..."
  "$@" -v ON_ERROR_STOP=1 -f "$file"
}

if [ "${2:-}" = "--superuser" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${APP_DIR}/.env"
  set +a

  if [ -z "${DATABASE_URL:-}" ]; then
    err "DATABASE_URL not set in ${APP_DIR}/.env"
    exit 1
  fi

  DB_NAME="${DATABASE_URL##*/}"
  DB_NAME="${DB_NAME%%\?*}"

  if [ -z "$DB_NAME" ]; then
    err "Could not parse database name from DATABASE_URL"
    exit 1
  fi

  for file in "${PATCH_FILES[@]}"; do
    run_file "$file" sudo -u postgres psql -d "$DB_NAME"
  done

elif [ -n "${2:-}" ] && [ -n "${3:-}" ] && [ -n "${4:-}" ]; then
  DB_USER="$2"
  DB_PASS="$3"
  DB_NAME="$4"

  for file in "${PATCH_FILES[@]}"; do
    run_file "$file" env PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME"
  done

else
  set -a
  # shellcheck source=/dev/null
  source "${APP_DIR}/.env"
  set +a

  if [ -z "${DATABASE_URL:-}" ]; then
    err "DATABASE_URL not set in ${APP_DIR}/.env"
    exit 1
  fi

  for file in "${PATCH_FILES[@]}"; do
    run_file "$file" psql "$DATABASE_URL"
  done
fi

log "Schema patches applied (${#PATCH_FILES[@]} file(s))"

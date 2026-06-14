#!/bin/bash
# Production frontend build tuned for low-RAM VPS (avoids exit 137 / OOM kill).
#
# Usage: bash scripts/build-frontend.sh APP_DIR [APP_USER]

set -euo pipefail

APP_DIR="${1:?Usage: build-frontend.sh APP_DIR [APP_USER]}"
APP_USER="${2:-monitoring}"

# Cap Node heap — with swap this is enough; without swap, ensure-swap.sh should run first.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
export BASE_PATH="${BASE_PATH:-/}"

echo "[build-frontend] NODE_OPTIONS=${NODE_OPTIONS}"
echo "[build-frontend] Building @workspace/monitoring in ${APP_DIR}..."

su - "$APP_USER" -c "cd '${APP_DIR}' && BASE_PATH='${BASE_PATH}' NODE_OPTIONS='${NODE_OPTIONS}' pnpm --filter @workspace/monitoring run build"

echo "[build-frontend] Done"

#!/bin/bash
# Ensure swap exists before memory-heavy builds (Vite) on small VPS instances.
# Exit 137 during `vite build` is almost always the Linux OOM killer.
#
# Usage (as root): bash scripts/ensure-swap.sh [SIZE_GB]
# Default: 2 GB swap if total swap < 512 MB

set -euo pipefail

SWAP_SIZE_GB="${1:-2}"
SWAP_FILE="/swapfile"
MIN_SWAP_MB=512

if [ "$EUID" -ne 0 ]; then
  echo "[ensure-swap] Must run as root — skipping"
  exit 0
fi

swap_mb() {
  free -m | awk '/^Swap:/ { print $2 }'
}

current_swap="$(swap_mb)"
if [ "${current_swap:-0}" -ge "$MIN_SWAP_MB" ]; then
  echo "[ensure-swap] Swap OK (${current_swap} MB)"
  exit 0
fi

echo "[ensure-swap] Low swap (${current_swap:-0} MB) — creating ${SWAP_SIZE_GB}G at ${SWAP_FILE}"

if swapon --show 2>/dev/null | grep -q "${SWAP_FILE}"; then
  echo "[ensure-swap] ${SWAP_FILE} already active"
  exit 0
fi

if [ ! -f "${SWAP_FILE}" ]; then
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l "${SWAP_SIZE_GB}G" "${SWAP_FILE}"
  else
    dd if=/dev/zero of="${SWAP_FILE}" bs=1M count=$((SWAP_SIZE_GB * 1024)) status=progress
  fi
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
fi

swapon "${SWAP_FILE}" 2>/dev/null || true

if ! grep -q "${SWAP_FILE}" /etc/fstab 2>/dev/null; then
  echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
fi

echo "[ensure-swap] Swap now: $(swap_mb) MB"

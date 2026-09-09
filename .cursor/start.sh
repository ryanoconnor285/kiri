#!/usr/bin/env bash
# Per-boot startup: bring PostgreSQL online before the dev servers launch.
set -euo pipefail

cd "$(dirname "$0")/.."

sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  pg_isready -h localhost -U postgres >/dev/null 2>&1 && break
  sleep 1
done

echo "PostgreSQL is ready."

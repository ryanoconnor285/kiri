#!/usr/bin/env bash
# Idempotent repository bootstrap for Cloud Agents.
# Prepares PostgreSQL, installs dependencies, builds shared packages,
# and applies the database schema + demo seed data.
set -euo pipefail

cd "$(dirname "$0")/.."

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/kiri}"
export DATABASE_URL

# 1. Ensure PostgreSQL is available (usually already present in the base snapshot).
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

# 2. Start PostgreSQL and make sure the role/database used by the app exist.
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  pg_isready -h localhost -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='kiri'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE kiri;"

# 3. Local env files (do not overwrite anything an agent may have customized).
[ -f .env ] || cp .env.example .env
[ -f apps/web/.env.local ] || cp apps/web/.env.local.example apps/web/.env.local

# 4. Install dependencies and build the shared packages the API depends on.
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm build

# 5. Database schema + demo data (drizzle meta is gitignored, so generate first).
pnpm db:generate
pnpm db:migrate
pnpm db:seed

echo "Kiri install complete."

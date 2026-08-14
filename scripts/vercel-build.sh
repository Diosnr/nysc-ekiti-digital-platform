#!/usr/bin/env bash
set -euo pipefail

# Resolve schema whether Vercel root is repo root or apps/web
if [ -f "packages/database/prisma/schema.prisma" ]; then
  SCHEMA="packages/database/prisma/schema.prisma"
  SEED="packages/database/prisma/seed.ts"
  WEB_DIR="apps/web"
elif [ -f "../../packages/database/prisma/schema.prisma" ]; then
  SCHEMA="../../packages/database/prisma/schema.prisma"
  SEED="../../packages/database/prisma/seed.ts"
  WEB_DIR="."
elif [ -f "prisma/schema.prisma" ]; then
  SCHEMA="prisma/schema.prisma"
  SEED="prisma/seed.ts"
  WEB_DIR="."
else
  echo "ERROR: cannot find prisma schema.prisma"
  echo "cwd=$(pwd)"
  ls -la
  exit 1
fi

echo "Using schema: $SCHEMA"
echo "Web dir: $WEB_DIR"
echo "cwd: $(pwd)"

npx prisma generate --schema="$SCHEMA"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Syncing database schema (prisma db push)…"
  npx prisma db push --schema="$SCHEMA" --skip-generate --accept-data-loss=false
  echo "Database schema synced."

  # Upsert roles/permissions (idempotent) so new roles appear in the UI
  if [ -f "$SEED" ]; then
    echo "Seeding roles and permissions…"
    npx tsx "$SEED" || echo "WARNING: seed failed (non-fatal)"
  fi
else
  echo "WARNING: DATABASE_URL not set — skipping db push/seed."
fi

if [ "$WEB_DIR" = "." ]; then
  npx next build
else
  npm run build --workspace=@nysc/web
fi

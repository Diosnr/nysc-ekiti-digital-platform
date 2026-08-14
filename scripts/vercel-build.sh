#!/usr/bin/env bash
set -euo pipefail

# Resolve schema whether Vercel root is repo root or apps/web
if [ -f "packages/database/prisma/schema.prisma" ]; then
  SCHEMA="packages/database/prisma/schema.prisma"
  WEB_DIR="apps/web"
elif [ -f "../../packages/database/prisma/schema.prisma" ]; then
  SCHEMA="../../packages/database/prisma/schema.prisma"
  WEB_DIR="."
elif [ -f "prisma/schema.prisma" ]; then
  SCHEMA="prisma/schema.prisma"
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

# Keep Neon schema in sync on every deploy (no manual db push needed).
# Requires DATABASE_URL in Vercel Environment Variables.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Syncing database schema (prisma db push)…"
  npx prisma db push --schema="$SCHEMA" --skip-generate --accept-data-loss=false
  echo "Database schema synced."
else
  echo "WARNING: DATABASE_URL not set — skipping db push. App may fail at runtime."
fi

if [ "$WEB_DIR" = "." ]; then
  npx next build
else
  npm run build --workspace=@nysc/web
fi

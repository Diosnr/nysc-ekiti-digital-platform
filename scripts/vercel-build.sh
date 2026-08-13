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

if [ "$WEB_DIR" = "." ]; then
  npx next build
else
  npm run build --workspace=@nysc/web
fi

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
  # Commit efd43c2 changed CampExitRequest.ground from CampExitGround enum → String.
  # prisma db push cannot alter a required enum column that already has rows.
  # Cast in place (no data loss) when the live column is still the enum type.
  echo "Ensuring CampExitRequest.ground is TEXT (safe enum→text cast if needed)…"
  npx prisma db execute --schema="$SCHEMA" --stdin <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CampExitRequest'
      AND column_name = 'ground'
      AND udt_name = 'CampExitGround'
  ) THEN
    ALTER TABLE "CampExitRequest"
      ALTER COLUMN "ground" TYPE TEXT
      USING ("ground"::text);
    RAISE NOTICE 'CampExitRequest.ground cast from CampExitGround to TEXT';
  ELSE
    RAISE NOTICE 'CampExitRequest.ground already TEXT (or table missing) — skip';
  END IF;
END $$;
SQL

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

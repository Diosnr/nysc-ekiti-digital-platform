-- One-time / idempotent: CampExitRequest.ground was CampExitGround enum;
-- schema now uses String. Safe cast keeps existing rows (MARITAL, MEDICAL, etc.).
-- Also run automatically from scripts/vercel-build.sh before prisma db push.

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
  END IF;
END $$;

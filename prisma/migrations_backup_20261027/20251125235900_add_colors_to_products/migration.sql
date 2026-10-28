-- Migration: Add colors column to Product
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "colors" JSONB NULL;

-- Optional: set default to empty array for existing rows
UPDATE "Product" SET "colors" = '[]'::jsonb WHERE "colors" IS NULL;

-- Note: Prisma migration timestamps/names can be different; this file provides the SQL change.

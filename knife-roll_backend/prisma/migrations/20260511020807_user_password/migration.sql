-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "password" TEXT NOT NULL DEFAULT 'changeme';

-- Drop the default so future inserts don't accidentally use it
ALTER TABLE "users" ALTER COLUMN "password" DROP DEFAULT;

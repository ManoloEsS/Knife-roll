/*
  Warnings:

  - You are about to drop the column `available` on the `shifts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('available', 'assigned', 'pending');

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "available",
ADD COLUMN     "incentive" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "status" "ShiftStatus" NOT NULL DEFAULT 'available';

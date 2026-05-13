/*
  Warnings:

  - You are about to drop the column `end_time` on the `shifts` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `shifts` table. All the data in the column will be lost.
  - You are about to alter the column `incentive` on the `shifts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - Added the required column `shift_time` to the `shifts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ShiftTime" AS ENUM ('breakfast', 'lunch', 'dinner');

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "end_time",
DROP COLUMN "start_time",
ADD COLUMN     "shift_time" "ShiftTime" NOT NULL,
ALTER COLUMN "incentive" SET DATA TYPE DECIMAL(65,30);

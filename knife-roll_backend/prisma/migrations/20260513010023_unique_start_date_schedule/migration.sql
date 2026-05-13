/*
  Warnings:

  - A unique constraint covering the columns `[start_date]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `shifts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "schedules_start_date_key" ON "schedules"("start_date");

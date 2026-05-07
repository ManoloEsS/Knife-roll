-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_schedule_id_fkey";

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

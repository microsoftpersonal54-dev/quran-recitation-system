-- AlterTable
ALTER TABLE "Mistake" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'REVIEWER';

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "paraQuarter" INTEGER;

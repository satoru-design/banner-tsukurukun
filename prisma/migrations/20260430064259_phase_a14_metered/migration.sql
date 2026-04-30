-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "isPreview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "proOverageNoticeShownAt" TIMESTAMP(3);

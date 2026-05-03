-- AlterTable
ALTER TABLE "User" ADD COLUMN     "upgradeNoticeShownAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UpgradeNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recommendedPlan" TEXT NOT NULL,
    "metricSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "UpgradeNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpgradeNotice_userId_createdAt_idx" ON "UpgradeNotice"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UpgradeNotice_type_idx" ON "UpgradeNotice"("type");

-- AddForeignKey
ALTER TABLE "UpgradeNotice" ADD CONSTRAINT "UpgradeNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

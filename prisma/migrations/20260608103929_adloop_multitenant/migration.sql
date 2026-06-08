
-- DropIndex
DROP INDEX "WinningPattern_dimension_value_windowEnd_idx";

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "MetaAd" ADD COLUMN     "accountId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WinningPattern" ADD COLUMN     "accountId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaAdAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_slug_key" ON "AdAccount"("slug");

-- CreateIndex
CREATE INDEX "Generation_accountId_idx" ON "Generation"("accountId");

-- CreateIndex
CREATE INDEX "MetaAd_accountId_idx" ON "MetaAd"("accountId");

-- CreateIndex
CREATE INDEX "WinningPattern_accountId_dimension_value_windowEnd_idx" ON "WinningPattern"("accountId", "dimension", "value", "windowEnd");

-- CreateIndex
CREATE INDEX "WinningPattern_accountId_windowEnd_idx" ON "WinningPattern"("accountId", "windowEnd");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinningPattern" ADD CONSTRAINT "WinningPattern_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


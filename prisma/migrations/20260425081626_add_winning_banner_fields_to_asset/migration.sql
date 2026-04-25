-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "analysisAbstract" JSONB,
ADD COLUMN     "analysisConcrete" JSONB,
ADD COLUMN     "analysisVersion" INTEGER,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");

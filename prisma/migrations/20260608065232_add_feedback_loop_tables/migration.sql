-- CreateTable
CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adSetId" TEXT,
    "campaignId" TEXT,
    "adName" TEXT,
    "status" TEXT,
    "generationImageId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "statDate" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4),
    "cpa" DECIMAL(12,2),
    "cpm" DECIMAL(12,2),
    "frequency" DECIMAL(8,2),
    "roas" DECIMAL(8,2),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinningPattern" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "adCount" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "avgCtr" DECIMAL(8,4),
    "avgCpa" DECIMAL(12,2),
    "score" DECIMAL(8,4) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinningPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAd_adId_key" ON "MetaAd"("adId");

-- CreateIndex
CREATE INDEX "MetaAd_generationImageId_idx" ON "MetaAd"("generationImageId");

-- CreateIndex
CREATE INDEX "MetaAd_status_idx" ON "MetaAd"("status");

-- CreateIndex
CREATE INDEX "AdPerformanceSnapshot_statDate_idx" ON "AdPerformanceSnapshot"("statDate");

-- CreateIndex
CREATE UNIQUE INDEX "AdPerformanceSnapshot_metaAdId_statDate_key" ON "AdPerformanceSnapshot"("metaAdId", "statDate");

-- CreateIndex
CREATE INDEX "WinningPattern_dimension_value_windowEnd_idx" ON "WinningPattern"("dimension", "value", "windowEnd");

-- AddForeignKey
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_generationImageId_fkey" FOREIGN KEY ("generationImageId") REFERENCES "GenerationImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_metaAdId_fkey" FOREIGN KEY ("metaAdId") REFERENCES "MetaAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;


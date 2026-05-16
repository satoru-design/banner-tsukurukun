-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "sourceLpId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentMonthLpUsageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proLpOverageNoticeShownAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "customDomain" TEXT,
    "ogImageUrl" TEXT,
    "analyticsConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageGeneration" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPageGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageDomain" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "vercelDomainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPageDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_customDomain_key" ON "LandingPage"("customDomain");

-- CreateIndex
CREATE INDEX "LandingPage_status_publishedAt_idx" ON "LandingPage"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_userId_slug_key" ON "LandingPage"("userId", "slug");

-- CreateIndex
CREATE INDEX "LandingPageGeneration_landingPageId_sectionType_idx" ON "LandingPageGeneration"("landingPageId", "sectionType");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPageDomain_landingPageId_key" ON "LandingPageDomain"("landingPageId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPageDomain_domain_key" ON "LandingPageDomain"("domain");

-- CreateIndex
CREATE INDEX "Generation_sourceLpId_idx" ON "Generation"("sourceLpId");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_sourceLpId_fkey" FOREIGN KEY ("sourceLpId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageGeneration" ADD CONSTRAINT "LandingPageGeneration_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

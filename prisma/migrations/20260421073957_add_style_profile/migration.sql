-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "styleProfileId" TEXT;

-- CreateTable
CREATE TABLE "StyleProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productContext" TEXT,
    "referenceImageUrls" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "typography" TEXT NOT NULL,
    "priceBadge" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "copyTone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StyleProfile_name_key" ON "StyleProfile"("name");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_styleProfileId_fkey" FOREIGN KEY ("styleProfileId") REFERENCES "StyleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

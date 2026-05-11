-- CreateTable
CREATE TABLE "BatchReject" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "materials" JSONB NOT NULL,
    "generationId" TEXT,
    "adId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchReject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchReject_createdAt_idx" ON "BatchReject"("createdAt");

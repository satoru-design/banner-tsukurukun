-- CreateTable
CREATE TABLE "GenerationVideo" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "vertexOperationId" TEXT,
    "blobUrl" TEXT,
    "inputImageUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "generateAudio" BOOLEAN NOT NULL DEFAULT false,
    "prompt" TEXT NOT NULL,
    "promptJa" TEXT,
    "costUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "providerMetadata" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationVideo_generationId_idx" ON "GenerationVideo"("generationId");

-- CreateIndex
CREATE INDEX "GenerationVideo_status_createdAt_idx" ON "GenerationVideo"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationVideo_isFavorite_favoritedAt_idx" ON "GenerationVideo"("isFavorite", "favoritedAt");

-- AddForeignKey
ALTER TABLE "GenerationVideo" ADD CONSTRAINT "GenerationVideo_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

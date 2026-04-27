-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "briefSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationImage" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationImage_generationId_idx" ON "GenerationImage"("generationId");

-- CreateIndex
CREATE INDEX "GenerationImage_isFavorite_favoritedAt_idx" ON "GenerationImage"("isFavorite", "favoritedAt");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationImage" ADD CONSTRAINT "GenerationImage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

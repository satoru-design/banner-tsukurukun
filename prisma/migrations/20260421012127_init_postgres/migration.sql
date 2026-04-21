-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "productName" TEXT,
    "lpUrl" TEXT,
    "target" TEXT,
    "mainCopy" TEXT,
    "subCopy" TEXT,
    "elements" TEXT,
    "base64Image" TEXT,
    "angle" TEXT,
    "imageModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

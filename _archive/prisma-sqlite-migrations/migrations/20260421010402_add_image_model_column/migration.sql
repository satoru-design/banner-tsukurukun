-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productName" TEXT,
    "lpUrl" TEXT,
    "target" TEXT,
    "mainCopy" TEXT,
    "subCopy" TEXT,
    "elements" TEXT,
    "base64Image" TEXT,
    "angle" TEXT,
    "imageModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

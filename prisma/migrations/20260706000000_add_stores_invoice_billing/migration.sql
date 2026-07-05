-- STORES請求書決済 (2026-06-22 feat/stores-invoice-payment) で schema.prisma に追加された
-- User.storesCustomerId + Invoice が migration 未作成のまま出荷され、本番で P2022
-- (column does not exist) を起こしていたのを解消する追いつきマイグレーション。

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "storesCustomerId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "storesPaymentId" TEXT,
    "paymentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_storesPaymentId_key" ON "Invoice"("storesPaymentId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_periodStart_key" ON "Invoice"("userId", "periodStart");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

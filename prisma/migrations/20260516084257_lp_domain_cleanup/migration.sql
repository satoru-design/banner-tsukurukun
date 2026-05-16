/*
  Warnings:

  - You are about to drop the column `customDomain` on the `LandingPage` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "LandingPage_customDomain_key";

-- AlterTable
ALTER TABLE "LandingPage" DROP COLUMN "customDomain";

-- AddForeignKey
ALTER TABLE "LandingPageDomain" ADD CONSTRAINT "LandingPageDomain_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

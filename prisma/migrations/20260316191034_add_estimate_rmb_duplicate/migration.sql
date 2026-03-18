/*
  Warnings:

  - A unique constraint covering the columns `[parentEstimateId]` on the table `Estimate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "parentEstimateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_parentEstimateId_key" ON "Estimate"("parentEstimateId");

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_parentEstimateId_fkey" FOREIGN KEY ("parentEstimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

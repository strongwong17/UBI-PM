/*
  Warnings:

  - A unique constraint covering the columns `[parentInvoiceId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "parentInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_parentInvoiceId_key" ON "Invoice"("parentInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_parentInvoiceId_fkey" FOREIGN KEY ("parentInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

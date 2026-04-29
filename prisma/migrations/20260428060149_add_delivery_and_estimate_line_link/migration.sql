-- AlterTable
ALTER TABLE "EstimateLineItem" ADD COLUMN     "deliveredQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "estimateLineItemId" TEXT;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_estimateLineItemId_fkey" FOREIGN KEY ("estimateLineItemId") REFERENCES "EstimateLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

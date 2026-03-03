import { prisma } from "@/lib/prisma";

function randomFourDigit(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

export async function generateEstimateNumber(): Promise<string> {
  const year = new Date().getFullYear();

  for (let i = 0; i < 10; i++) {
    const num = randomFourDigit();
    const estimateNumber = `EST-${year}-${String(num).padStart(4, "0")}`;
    const exists = await prisma.estimate.findUnique({
      where: { estimateNumber },
      select: { id: true },
    });
    if (!exists) return estimateNumber;
  }

  // Fallback: timestamp-based
  const ts = Date.now().toString().slice(-6);
  return `EST-${year}-${ts}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();

  for (let i = 0; i < 10; i++) {
    const num = randomFourDigit();
    const invoiceNumber = `INV-${year}-${String(num).padStart(4, "0")}`;
    const exists = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (!exists) return invoiceNumber;
  }

  const ts = Date.now().toString().slice(-6);
  return `INV-${year}-${ts}`;
}

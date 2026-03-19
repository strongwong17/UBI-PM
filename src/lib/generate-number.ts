import { prisma } from "@/lib/prisma";

function randomFourDigit(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

/**
 * Generate estimate number: ACME-ProjectName-NNNN
 * Uses client shortName if available, falls back to company name
 */
export async function generateEstimateNumber(
  shortName?: string,
  projectTitle?: string
): Promise<string> {
  const prefix = buildPrefix(shortName, projectTitle);

  for (let i = 0; i < 10; i++) {
    const num = randomFourDigit();
    const estimateNumber = `${prefix}-${num}`;
    const exists = await prisma.estimate.findUnique({
      where: { estimateNumber },
      select: { id: true },
    });
    if (!exists) return estimateNumber;
  }

  const ts = Date.now().toString().slice(-6);
  return `${prefix}-${ts}`;
}

/**
 * Generate invoice number: ACME-ProjectName-NNNN
 * Uses client shortName if available, falls back to company name
 */
export async function generateInvoiceNumber(
  shortName?: string,
  projectTitle?: string
): Promise<string> {
  const prefix = buildPrefix(shortName, projectTitle);

  for (let i = 0; i < 10; i++) {
    const num = randomFourDigit();
    const invoiceNumber = `${prefix}-${num}`;
    const exists = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (!exists) return invoiceNumber;
  }

  const ts = Date.now().toString().slice(-6);
  return `${prefix}-${ts}`;
}

function buildPrefix(shortName?: string, projectTitle?: string): string {
  const client = shortName?.trim() || "EST";
  const project = projectTitle ? slugify(projectTitle, 20) : "";
  if (project) return `${client}-${project}`;
  return client;
}

/** Create a short, clean slug from a string */
function slugify(str: string, maxLen: number): string {
  const cleaned = str
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trim();
}

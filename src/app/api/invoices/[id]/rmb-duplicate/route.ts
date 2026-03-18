import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateInvoiceNumber } from "@/lib/generate-number";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { exchangeRate, additionalTaxRate = 10 } = body;

    if (!exchangeRate || exchangeRate <= 0 || !isFinite(exchangeRate)) {
      return NextResponse.json(
        { error: "A valid exchange rate is required" },
        { status: 400 }
      );
    }
    if (additionalTaxRate < 0 || additionalTaxRate > 100 || !isFinite(additionalTaxRate)) {
      return NextResponse.json(
        { error: "Additional tax rate must be between 0 and 100" },
        { status: 400 }
      );
    }

    const original = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        rmbDuplicate: { select: { id: true } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (original.rmbDuplicate) {
      return NextResponse.json(
        { error: "An RMB duplicate already exists for this invoice" },
        { status: 409 }
      );
    }

    // Convert line items
    const convertedLineItems = original.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Math.round(item.unitPrice * exchangeRate * 100) / 100,
      total: Math.round(item.quantity * item.unitPrice * exchangeRate * 100) / 100,
      sortOrder: item.sortOrder,
    }));

    const subtotal = convertedLineItems.reduce((sum, li) => sum + li.total, 0);
    const discount = Math.round(original.discount * exchangeRate * 100) / 100;
    const taxable = subtotal - discount;
    const combinedTaxRate = original.taxRate + additionalTaxRate;
    const tax = Math.round(taxable * (combinedTaxRate / 100) * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const invoiceNumber = await generateInvoiceNumber();

    const rmbInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: "DRAFT",
        currency: "CNY",
        exchangeRate,
        subtotal,
        taxRate: combinedTaxRate,
        tax,
        discount,
        total,
        issuedDate: original.issuedDate,
        dueDate: original.dueDate,
        notes: original.notes
          ? `${original.notes}\n\nExchange Rate: 1 USD = ${exchangeRate} CNY (includes ${additionalTaxRate}% additional tax)`
          : `Exchange Rate: 1 USD = ${exchangeRate} CNY (includes ${additionalTaxRate}% additional tax)`,
        contactEmail: original.contactEmail,
        projectId: original.projectId,
        estimateId: original.estimateId,
        parentInvoiceId: original.id,
        lineItems: { create: convertedLineItems },
      },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    await logActivity({
      action: "GENERATE",
      entityType: "INVOICE",
      entityId: rmbInvoice.id,
      entityLabel: rmbInvoice.invoiceNumber,
      description: `Generated RMB duplicate ${rmbInvoice.invoiceNumber} from ${original.invoiceNumber} (rate: ${exchangeRate})`,
      userId,
      projectId: original.projectId,
    });

    return NextResponse.json(rmbInvoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create RMB duplicate:", error);
    return NextResponse.json(
      { error: "Failed to create RMB duplicate" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { buildInvoiceFromEstimate } from "@/lib/invoice-from-estimate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id, invoiceId } = await params;

    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!existing || existing.projectId !== id || existing.deletedAt) {
      return NextResponse.json({ error: "Invoice not found for this project" }, { status: 404 });
    }
    if (existing.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot regenerate a paid invoice. Change its status first." },
        { status: 400 }
      );
    }
    if (!existing.estimateId) {
      return NextResponse.json(
        { error: "Invoice has no source estimate to regenerate from" },
        { status: 400 }
      );
    }

    const estimate = await prisma.estimate.findUnique({
      where: { id: existing.estimateId },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!estimate) {
      return NextResponse.json({ error: "Source estimate not found" }, { status: 404 });
    }
    if (estimate.parentEstimateId) {
      return NextResponse.json(
        { error: "Cannot regenerate from RMB-duplicate estimate" },
        { status: 400 }
      );
    }

    const built = buildInvoiceFromEstimate(estimate);
    if (built.lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable lines (nothing delivered)" },
        { status: 400 }
      );
    }

    // `buildInvoiceFromEstimate` produces the estimate-currency (USD) figures.
    // For an RMB duplicate (has a stored exchangeRate), convert the freshly-built
    // lines/discount at that rate and keep the invoice's stored (combined) tax
    // rate — mirroring how the RMB duplicate was originally created. Plain
    // invoices use the built values unchanged.
    const rate = existing.exchangeRate ?? 0;
    const isConverted = rate > 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const finalLineItems = built.lineItems.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: isConverted ? round2(l.unitPrice * rate) : l.unitPrice,
      total: isConverted ? round2(l.total * rate) : l.total,
      sortOrder: l.sortOrder,
      estimateLineItemId: l.estimateLineItemId,
    }));

    const subtotal = isConverted
      ? round2(finalLineItems.reduce((s, l) => s + l.total, 0))
      : built.subtotal;
    const taxRate = isConverted ? existing.taxRate : built.taxRate;
    const discount = isConverted ? round2(built.discount * rate) : built.discount;
    const taxable = subtotal - discount;
    const tax = isConverted ? round2(taxable * (taxRate / 100)) : built.tax;
    const total = isConverted ? round2(taxable + tax) : built.total;

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: existing.status === "DRAFT" ? undefined : "DRAFT",
          subtotal,
          taxRate,
          tax,
          discount,
          total,
          lineItems: { create: finalLineItems },
        },
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await logActivity({
      action: "UPDATE",
      entityType: "INVOICE",
      entityId: invoiceId,
      entityLabel: existing.invoiceNumber,
      description: `Corrected invoice ${existing.invoiceNumber} (regenerated from actuals)`,
      metadata: {
        total: { from: existing.total, to: total },
        lineItemsChanged: true,
      },
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to regenerate invoice:", error);
    return NextResponse.json({ error: "Failed to regenerate invoice" }, { status: 500 });
  }
}

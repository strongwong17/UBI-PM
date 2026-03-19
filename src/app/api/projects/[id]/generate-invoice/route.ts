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
    const { estimateId } = body;

    if (!estimateId) {
      return NextResponse.json({ error: "estimateId is required" }, { status: 400 });
    }

    // Check if this estimate already has an invoice
    const existingInvoice = await prisma.invoice.findFirst({
      where: { estimateId, deletedAt: null },
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "An invoice already exists for this estimate" },
        { status: 409 }
      );
    }

    // Fetch project for naming
    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: { select: { company: true, shortName: true } } },
    });

    // Fetch the specific approved estimate
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        phases: {
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!estimate || estimate.projectId !== id || !project) {
      return NextResponse.json({ error: "Estimate not found for this project" }, { status: 404 });
    }

    if (!estimate.isApproved) {
      return NextResponse.json(
        { error: "Estimate must be approved before generating an invoice" },
        { status: 400 }
      );
    }

    // Build line items from estimate phases/lineItems
    const lineItems: { description: string; quantity: number; unitPrice: number; total: number; sortOrder: number }[] = [];
    let sortOrder = 0;
    for (const phase of estimate.phases) {
      for (const item of phase.lineItems) {
        lineItems.push({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          sortOrder: sortOrder++,
        });
      }
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    const taxRate = estimate.taxRate;
    const discount = estimate.discount;
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;

    const invoiceNumber = await generateInvoiceNumber(project.client.shortName || project.client.company, project.title);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          status: "DRAFT",
          currency: estimate.currency,
          subtotal,
          taxRate,
          tax,
          discount,
          total,
          projectId: id,
          estimateId: estimate.id,
          lineItems: { create: lineItems },
        },
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });

      // Don't auto-set INVOICED here — that happens when invoice status is set to SENT

      return inv;
    });

    await logActivity({
      action: "GENERATE",
      entityType: "INVOICE",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      description: `Generated invoice ${invoice.invoiceNumber} from estimate ${estimate.estimateNumber}`,
      userId,
      projectId: id,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}

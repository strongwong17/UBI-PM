import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateInvoiceNumber } from "@/lib/generate-number";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!estimate || estimate.projectId !== id) {
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

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          status: "DRAFT",
          currency: estimate.currency,
          subtotal,
          taxRate,
          tax,
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

      // Set project status to INVOICED if not already past that
      const project = await tx.project.findUnique({ where: { id }, select: { status: true } });
      if (project && !["INVOICED", "PAID", "CLOSED"].includes(project.status)) {
        await tx.project.update({
          where: { id },
          data: { status: "INVOICED" },
        });
      }

      return inv;
    });

    await logActivity({
      action: "GENERATE",
      entityType: "INVOICE",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      description: `Generated invoice ${invoice.invoiceNumber} from estimate ${estimate.estimateNumber}`,
      userId: (session.user as any).id,
      projectId: id,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}

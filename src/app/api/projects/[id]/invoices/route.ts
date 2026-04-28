// src/app/api/projects/[id]/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { generateInvoiceNumber } from "@/lib/generate-number";

type SliceLine = { estimateLineItemId: string; quantity: number; description?: string };

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
    const {
      estimateId,
      mode,
      lines,
      percent,
      flatAmount,
      flatDescription,
      notes,
      taxRate: taxRateOverride,
      discount: discountOverride,
    } = body as {
      estimateId?: string;
      mode?: "SLICE" | "PERCENT" | "FLAT";
      lines?: SliceLine[];
      percent?: number;
      flatAmount?: number;
      flatDescription?: string;
      notes?: string;
      taxRate?: number;
      discount?: number;
    };

    if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 });
    if (!mode || !["SLICE", "PERCENT", "FLAT"].includes(mode)) {
      return NextResponse.json({ error: "mode must be SLICE | PERCENT | FLAT" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: { select: { company: true, shortName: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

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
      return NextResponse.json({ error: "Estimate must be approved" }, { status: 400 });
    }
    if (estimate.parentEstimateId) {
      return NextResponse.json({ error: "Cannot invoice from RMB-duplicate estimate" }, { status: 400 });
    }

    // Build line items per mode
    let invoiceLines: { description: string; quantity: number; unitPrice: number; total: number; sortOrder: number; estimateLineItemId: string | null }[] = [];

    if (mode === "SLICE") {
      if (!lines || lines.length === 0) {
        return NextResponse.json({ error: "lines required for SLICE mode" }, { status: 400 });
      }
      const allEstimateLines = estimate.phases.flatMap((p) => p.lineItems);
      let sortOrder = 0;
      for (const ln of lines) {
        const src = allEstimateLines.find((l) => l.id === ln.estimateLineItemId);
        if (!src) {
          return NextResponse.json({ error: `Estimate line ${ln.estimateLineItemId} not found` }, { status: 400 });
        }
        if (ln.quantity <= 0) continue;
        invoiceLines.push({
          description: ln.description ?? src.description,
          quantity: ln.quantity,
          unitPrice: src.unitPrice,
          total: ln.quantity * src.unitPrice,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      }
      if (invoiceLines.length === 0) {
        return NextResponse.json({ error: "No billable lines (all quantities are zero)" }, { status: 400 });
      }
    } else if (mode === "PERCENT") {
      if (typeof percent !== "number" || percent <= 0 || percent > 100) {
        return NextResponse.json({ error: "percent must be 0..100" }, { status: 400 });
      }
      const subtotal = estimate.phases.reduce(
        (s, p) => s + p.lineItems.reduce((ss, l) => ss + l.quantity * l.unitPrice, 0),
        0
      );
      const amount = subtotal * (percent / 100);
      invoiceLines.push({
        description: `${percent}% of ${estimate.estimateNumber}`,
        quantity: 1,
        unitPrice: amount,
        total: amount,
        sortOrder: 0,
        estimateLineItemId: null,
      });
    } else {
      // FLAT
      if (typeof flatAmount !== "number" || flatAmount <= 0) {
        return NextResponse.json({ error: "flatAmount required" }, { status: 400 });
      }
      if (!flatDescription?.trim()) {
        return NextResponse.json({ error: "flatDescription required" }, { status: 400 });
      }
      invoiceLines.push({
        description: flatDescription.trim(),
        quantity: 1,
        unitPrice: flatAmount,
        total: flatAmount,
        sortOrder: 0,
        estimateLineItemId: null,
      });
    }

    const subtotal = invoiceLines.reduce((s, l) => s + l.total, 0);
    const taxRate = taxRateOverride ?? estimate.taxRate;
    const discount = discountOverride ?? estimate.discount;
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;

    const invoiceNumber = await generateInvoiceNumber(
      project.client.shortName || project.client.company,
      project.title
    );

    const invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          invoiceNumber,
          status: "DRAFT",
          currency: estimate.currency,
          subtotal,
          taxRate,
          tax,
          discount,
          total,
          notes: notes ?? null,
          projectId: id,
          estimateId: estimate.id,
          lineItems: { create: invoiceLines },
        },
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    await logActivity({
      action: "GENERATE",
      entityType: "INVOICE",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      description: `Created invoice ${invoice.invoiceNumber} (${mode}) from ${estimate.estimateNumber}`,
      userId,
      projectId: id,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        project: { include: { client: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, issuedDate, dueDate, taxRate, notes, contactEmail, lineItems } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { generateInvoiceNumber } = await import("@/lib/generate-number");
    const invoiceNumber = await generateInvoiceNumber();

    const items: { description: string; quantity: number; unitPrice: number; sortOrder?: number }[] =
      lineItems || [];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const appliedTaxRate = taxRate ?? 0;
    const tax = subtotal * (appliedTaxRate / 100);
    const total = subtotal + tax;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: "DRAFT",
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        subtotal,
        taxRate: appliedTaxRate,
        tax,
        total,
        notes: notes?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        projectId,
        lineItems:
          items.length > 0
            ? {
                create: items.map((item, i) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.quantity * item.unitPrice,
                  sortOrder: item.sortOrder ?? i,
                })),
              }
            : undefined,
      },
      include: {
        project: { include: { client: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

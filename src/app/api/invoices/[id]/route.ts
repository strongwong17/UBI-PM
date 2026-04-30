import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkAndAutoArchive } from "@/lib/auto-archive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: true,
          },
        },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { status, issuedDate, dueDate, notes, contactEmail, discount, lineItems } = body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (issuedDate !== undefined) updateData.issuedDate = issuedDate ? new Date(issuedDate) : null;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (notes !== undefined) updateData.notes = notes;
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (discount !== undefined) updateData.discount = discount;

      // PAID → set paidDate
      if (status === "PAID" && existing.status !== "PAID") {
        updateData.paidDate = new Date();
      }

      // Update line items if provided (replace all)
      if (lineItems && Array.isArray(lineItems)) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLineItem.createMany({
          data: lineItems.map((item: { description: string; quantity: number; unitPrice: number; total: number; sortOrder: number }, idx: number) => ({
            invoiceId: id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: item.sortOrder ?? idx,
          })),
        });

        // Recalculate totals
        const subtotal = lineItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);
        const disc = discount ?? existing.discount;
        const taxable = subtotal - disc;
        const tax = taxable * (existing.taxRate / 100);
        updateData.subtotal = subtotal;
        updateData.tax = tax;
        updateData.total = taxable + tax;
      } else if (discount !== undefined) {
        // Recalculate totals with new discount
        const taxable = existing.subtotal - discount;
        const tax = taxable * (existing.taxRate / 100);
        updateData.tax = tax;
        updateData.total = taxable + tax;
      }

      const inv = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });

      return inv;
    });

    if (status && status !== existing.status) {
      await logActivity({
        action: "STATUS_CHANGE",
        entityType: "INVOICE",
        entityId: id,
        entityLabel: existing.invoiceNumber,
        description: `Changed invoice status from ${existing.status} to ${status}`,
        metadata: { from: existing.status, to: status },
        userId,
        projectId: existing.projectId,
      });
      if (status === "PAID") {
        await checkAndAutoArchive(existing.projectId, userId);
      }
    } else {
      await logActivity({
        action: "UPDATE",
        entityType: "INVOICE",
        entityId: id,
        entityLabel: existing.invoiceNumber,
        description: `Updated invoice ${existing.invoiceNumber}`,
        userId,
        projectId: existing.projectId,
      });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      action: "DELETE",
      entityType: "INVOICE",
      entityId: id,
      entityLabel: existing.invoiceNumber,
      description: `Deleted invoice ${existing.invoiceNumber}`,
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}

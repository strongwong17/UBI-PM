import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, issuedDate, dueDate, notes, contactEmail } = body;

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

      // PAID → set paidDate
      if (status === "PAID" && existing.status !== "PAID") {
        updateData.paidDate = new Date();
      }

      const inv = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          project: { select: { id: true, title: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      });

      // PAID → set project status to PAID
      if (status === "PAID" && existing.status !== "PAID") {
        await tx.project.update({
          where: { id: existing.projectId },
          data: { status: "PAID" },
        });
      }

      return inv;
    });

    const userId = (session.user as any).id;
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      userId: (session.user as any).id,
      projectId: existing.projectId,
    });

    return NextResponse.json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}

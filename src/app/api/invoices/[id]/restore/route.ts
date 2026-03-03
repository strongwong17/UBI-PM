import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

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
    const userId = (session.user as any).id;

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { project: { select: { id: true, projectNumber: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!existing.deletedAt) {
      return NextResponse.json({ error: "Invoice is not deleted" }, { status: 400 });
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: { deletedAt: null },
    });

    await logActivity({
      action: "RESTORE",
      entityType: "INVOICE",
      entityId: id,
      entityLabel: existing.invoiceNumber,
      description: `Restored invoice ${existing.invoiceNumber}`,
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error restoring invoice:", error);
    return NextResponse.json({ error: "Failed to restore invoice" }, { status: 500 });
  }
}

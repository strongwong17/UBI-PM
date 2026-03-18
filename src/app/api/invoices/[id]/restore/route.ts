import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

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

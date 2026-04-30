import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const VALID_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED"];

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
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.estimate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const estimate = await prisma.$transaction(async (tx) => {
      const est = await tx.estimate.update({
        where: { id },
        data: { status },
        include: {
          project: { include: { client: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          phases: {
            include: { lineItems: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      return est;
    });

    await logActivity({
      action: "STATUS_CHANGE",
      entityType: "ESTIMATE",
      entityId: id,
      entityLabel: existing.estimateNumber,
      description: `Changed estimate status from ${existing.status} to ${status}`,
      metadata: { from: existing.status, to: status },
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Error updating estimate status:", error);
    return NextResponse.json({ error: "Failed to update estimate status" }, { status: 500 });
  }
}

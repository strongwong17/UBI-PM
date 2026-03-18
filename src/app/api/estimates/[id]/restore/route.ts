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

    const existing = await prisma.estimate.findUnique({
      where: { id },
      include: { project: { select: { id: true, projectNumber: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (!existing.deletedAt) {
      return NextResponse.json({ error: "Estimate is not deleted" }, { status: 400 });
    }

    const estimate = await prisma.estimate.update({
      where: { id },
      data: { deletedAt: null },
    });

    await logActivity({
      action: "RESTORE",
      entityType: "ESTIMATE",
      entityId: id,
      entityLabel: existing.estimateNumber,
      description: `Restored estimate ${existing.estimateNumber}`,
      userId,
      projectId: existing.projectId,
    });

    return NextResponse.json(estimate);
  } catch (error) {
    console.error("Error restoring estimate:", error);
    return NextResponse.json({ error: "Failed to restore estimate" }, { status: 500 });
  }
}

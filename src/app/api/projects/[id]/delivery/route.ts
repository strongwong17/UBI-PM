// src/app/api/projects/[id]/delivery/route.ts
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
    const body = await request.json();
    const { lines } = body as {
      lines?: { estimateLineItemId: string; deliveredQuantity: number | null }[];
    };

    if (!Array.isArray(lines)) {
      return NextResponse.json({ error: "lines array required" }, { status: 400 });
    }

    // Verify all line IDs belong to estimates of this project
    const ids = lines.map((l) => l.estimateLineItemId);
    const found = await prisma.estimateLineItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, phase: { select: { estimate: { select: { projectId: true } } } } },
    });
    const mismatched = found.filter((f) => f.phase.estimate.projectId !== id);
    if (mismatched.length > 0 || found.length !== lines.length) {
      return NextResponse.json({ error: "Some line items do not belong to this project" }, { status: 400 });
    }

    const updated = await prisma.$transaction(
      lines.map((l) =>
        prisma.estimateLineItem.update({
          where: { id: l.estimateLineItemId },
          data: { deliveredQuantity: l.deliveredQuantity },
        })
      )
    );

    await logActivity({
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: id,
      description: `Updated delivered quantities for ${updated.length} line item(s)`,
      userId,
      projectId: id,
    });

    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    console.error("Failed to update delivery:", error);
    return NextResponse.json({ error: "Failed to update delivery" }, { status: 500 });
  }
}

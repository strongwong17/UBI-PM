import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const completion = await prisma.projectCompletion.findUnique({
      where: { projectId: id },
      include: { internalCompletedBy: { select: { name: true } } },
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error("Failed to fetch completion:", error);
    return NextResponse.json({ error: "Failed to fetch completion" }, { status: 500 });
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

    const {
      internalCompleted,
      internalNotes,
      clientAcknowledged,
      clientAcknowledgedBy,
      clientAcknowledgeNotes,
      deliverablesNotes,
    } = body;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const existing = await prisma.projectCompletion.findUnique({ where: { projectId: id } });

    const updateData: Record<string, unknown> = {};
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (clientAcknowledgedBy !== undefined) updateData.clientAcknowledgedBy = clientAcknowledgedBy;
    if (clientAcknowledgeNotes !== undefined) updateData.clientAcknowledgeNotes = clientAcknowledgeNotes;
    if (deliverablesNotes !== undefined) updateData.deliverablesNotes = deliverablesNotes;

    // Auto-set timestamps on boolean toggles
    if (internalCompleted !== undefined) {
      updateData.internalCompleted = internalCompleted;
      if (internalCompleted && !existing?.internalCompleted) {
        updateData.internalCompletedAt = new Date();
        updateData.internalCompletedById = userId;
      } else if (!internalCompleted) {
        updateData.internalCompletedAt = null;
        updateData.internalCompletedById = null;
      }
    }
    if (clientAcknowledged !== undefined) {
      updateData.clientAcknowledged = clientAcknowledged;
      if (clientAcknowledged && !existing?.clientAcknowledged) {
        updateData.clientAcknowledgedAt = new Date();
      } else if (!clientAcknowledged) {
        updateData.clientAcknowledgedAt = null;
      }
    }

    let completion;
    if (existing) {
      completion = await prisma.projectCompletion.update({
        where: { projectId: id },
        data: updateData,
        include: { internalCompletedBy: { select: { name: true } } },
      });
    } else {
      completion = await prisma.projectCompletion.create({
        data: { projectId: id, ...updateData } as any,
        include: { internalCompletedBy: { select: { name: true } } },
      });
    }

    // If both completed, set project status to COMPLETED
    if (completion.internalCompleted && completion.clientAcknowledged) {
      await prisma.project.update({
        where: { id },
        data: { status: "COMPLETED" },
      });
    }

    await logActivity({
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: id,
      description: internalCompleted ? "Marked project internally complete" : "Updated project completion",
      userId,
      projectId: id,
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error("Failed to update completion:", error);
    return NextResponse.json({ error: "Failed to update completion" }, { status: 500 });
  }
}

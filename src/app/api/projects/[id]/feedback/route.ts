import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkAndAutoArchive } from "@/lib/auto-archive";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const feedback = await prisma.projectFeedback.findUnique({
      where: { projectId: id },
      include: { internalSubmittedBy: { select: { name: true } } },
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Failed to fetch feedback:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

export async function PUT(
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
      internalContent,
      internalSubmit,        // boolean — caller flips to true to mark internal feedback as final
      clientContent,
      clientSubmittedByName,
      clientSubmit,          // boolean — caller flips to true to mark client feedback as final
    } = body as {
      internalContent?: string | null;
      internalSubmit?: boolean;
      clientContent?: string | null;
      clientSubmittedByName?: string | null;
      clientSubmit?: boolean;
    };

    const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await prisma.projectFeedback.findUnique({ where: { projectId: id } });

    const data: Prisma.ProjectFeedbackUncheckedUpdateInput = {};
    if (internalContent !== undefined) data.internalContent = internalContent;
    if (clientContent !== undefined) data.clientContent = clientContent;
    if (clientSubmittedByName !== undefined) data.clientSubmittedByName = clientSubmittedByName;

    // Submit toggles — set timestamp if flipping to true, clear if flipping to false.
    if (internalSubmit === true && !existing?.internalSubmittedAt) {
      data.internalSubmittedAt = new Date();
      data.internalSubmittedById = userId;
    } else if (internalSubmit === false) {
      data.internalSubmittedAt = null;
      data.internalSubmittedById = null;
    }
    if (clientSubmit === true && !existing?.clientSubmittedAt) {
      data.clientSubmittedAt = new Date();
    } else if (clientSubmit === false) {
      data.clientSubmittedAt = null;
    }

    const feedback = existing
      ? await prisma.projectFeedback.update({
          where: { projectId: id },
          data,
          include: { internalSubmittedBy: { select: { name: true } } },
        })
      : await prisma.projectFeedback.create({
          data: { projectId: id, ...data } as Prisma.ProjectFeedbackUncheckedCreateInput,
          include: { internalSubmittedBy: { select: { name: true } } },
        });

    await logActivity({
      action: "UPDATE",
      entityType: "PROJECT",
      entityId: id,
      description:
        internalSubmit === true
          ? "Submitted internal feedback"
          : clientSubmit === true
          ? "Submitted client feedback"
          : "Updated project feedback",
      userId,
      projectId: id,
    });

    // Submitting feedback may have closed the auto-archive gate.
    if (internalSubmit === true || clientSubmit === true) {
      await checkAndAutoArchive(id, userId);
    }

    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Failed to update feedback:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}

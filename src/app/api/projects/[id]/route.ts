import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
        primaryContact: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        inquiry: { include: { serviceModules: { orderBy: { sortOrder: "asc" } } } },
        estimates: {
          include: {
            phases: { include: { lineItems: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
            createdBy: { select: { name: true } },
          },
          orderBy: { version: "asc" },
        },
        invoices: { where: { deletedAt: null }, include: { lineItems: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" } },
        completion: { include: { internalCompletedBy: { select: { name: true } } } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
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
    const { status, title, executionPhase, primaryContactId, assignedToId, startDate, endDate, notes } = body;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Auto-set startDate when transitioning to IN_PROGRESS
    const autoStartDate =
      status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS" && !existing.startDate && startDate === undefined
        ? new Date()
        : undefined;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
        ...(executionPhase !== undefined && { executionPhase }),
        ...(primaryContactId !== undefined && { primaryContactId }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(autoStartDate && { startDate: autoStartDate }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        client: true,
        primaryContact: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    if (status && status !== existing.status) {
      await logActivity({
        action: "STATUS_CHANGE",
        entityType: "PROJECT",
        entityId: id,
        entityLabel: existing.projectNumber,
        description: `Changed project status from ${existing.status} to ${status}`,
        metadata: { from: existing.status, to: status },
        userId,
        projectId: id,
      });
    } else {
      await logActivity({
        action: "UPDATE",
        entityType: "PROJECT",
        entityId: id,
        entityLabel: existing.projectNumber,
        description: `Updated project ${existing.projectNumber}`,
        userId,
        projectId: id,
      });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Collect attachment files to delete from disk after DB transaction
    const attachments = await prisma.attachment.findMany({
      where: { projectId: id },
      select: { storedName: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Null out self-referential FK on estimates so they can be deleted
      await tx.estimate.updateMany({
        where: { projectId: id },
        data: { duplicatedFromId: null },
      });
      // 2. Delete invoice + line items (InvoiceLineItem cascades from Invoice)
      await tx.invoice.deleteMany({ where: { projectId: id } });
      // 3. Delete estimates + phases + line items (EstimatePhase/EstimateLineItem cascade)
      await tx.estimate.deleteMany({ where: { projectId: id } });
      // 4. Delete project — Inquiry/modules/completion/attachments all cascade
      await tx.project.delete({ where: { id } });
    });

    // Delete attachment files from disk (best-effort)
    for (const att of attachments) {
      try {
        await unlink(path.join(UPLOAD_DIR, att.storedName));
      } catch {
        // ignore missing files
      }
    }

    await logActivity({
      action: "DELETE",
      entityType: "PROJECT",
      entityId: id,
      entityLabel: existing.projectNumber,
      description: `Deleted project ${existing.projectNumber}`,
      userId,
    });

    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}

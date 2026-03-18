import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete file from disk (ignore if already missing)
    try {
      await unlink(path.join(UPLOAD_DIR, attachment.storedName));
    } catch {
      // file may have been manually removed
    }

    await prisma.attachment.delete({ where: { id } });

    await logActivity({
      action: "DELETE",
      entityType: "ATTACHMENT",
      entityId: id,
      entityLabel: attachment.filename,
      description: `Deleted attachment ${attachment.filename}`,
      userId,
      projectId: attachment.projectId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

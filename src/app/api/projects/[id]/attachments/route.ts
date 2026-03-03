import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name);
    const storedName = `${crypto.randomUUID()}${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    const attachment = await prisma.attachment.create({
      data: {
        filename: file.name,
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        projectId: id,
      },
    });

    await logActivity({
      action: "CREATE",
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      entityLabel: attachment.filename,
      description: `Uploaded attachment ${attachment.filename}`,
      userId: (session.user as any).id,
      projectId: id,
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Failed to upload attachment:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

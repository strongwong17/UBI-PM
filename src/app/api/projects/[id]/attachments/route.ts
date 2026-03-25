import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const steps: string[] = [];
  try {
    steps.push("start");

    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;
    steps.push("auth-ok");

    const { id } = await params;
    steps.push(`id:${id}`);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    steps.push("project-found");

    const formData = await request.formData();
    steps.push("formdata-parsed");

    const file = formData.get("file") as File | null;
    steps.push(`file:${file?.name}|${file?.type}|${file?.size}`);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
    }

    // Validate MIME type
    const ALLOWED_TYPES = [
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "text/plain", "text/csv",
      // Images
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "image/svg+xml", "image/heic", "image/heif",
      // Archives
      "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
      "application/vnd.rar",
      // Email
      "message/rfc822", "application/vnd.ms-outlook",
      // Media
      "video/mp4", "video/quicktime",
      "audio/mpeg", "audio/wav",
      // Fallback for unknown
      "application/octet-stream",
    ];
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type "${file.type}" not allowed` }, { status: 400 });
    }
    steps.push("validated");

    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${crypto.randomUUID()}${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
    steps.push("written");

    const attachment = await prisma.attachment.create({
      data: {
        filename: file.name,
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        projectId: id,
      },
    });
    steps.push("db-ok");

    await logActivity({
      action: "CREATE",
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      entityLabel: attachment.filename,
      description: `Uploaded attachment ${attachment.filename}`,
      userId,
      projectId: id,
    });

    return NextResponse.json(attachment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Upload failed: ${message}`, steps },
      { status: 500 }
    );
  }
}

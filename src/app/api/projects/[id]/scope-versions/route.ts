import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;

    const inquiry = await prisma.inquiry.findUnique({
      where: { projectId: id },
      select: { id: true },
    });

    if (!inquiry) {
      return NextResponse.json([]);
    }

    const versions = await prisma.scopeVersion.findMany({
      where: { inquiryId: inquiry.id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { version: "desc" },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Failed to fetch scope versions:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { userId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { projectId: id },
      select: { id: true },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Project brief not found" }, { status: 404 });
    }

    // Get next version number
    const latest = await prisma.scopeVersion.findFirst({
      where: { inquiryId: inquiry.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Generate unique confirmation token
    const confirmToken = crypto.randomBytes(32).toString("hex");

    const version = await prisma.scopeVersion.create({
      data: {
        content: content.trim(),
        version: nextVersion,
        createdById: userId,
        confirmToken,
        inquiryId: inquiry.id,
      },
      include: { createdBy: { select: { name: true } } },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Failed to create scope version:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;
    const { id } = await params;

    const signals = await prisma.clientSignal.findMany({
      where: { projectId: id },
      include: { createdBy: { select: { name: true } }, actionItems: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(signals);
  } catch (error) {
    console.error("Failed to fetch signals:", error);
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
    const { title, content, source, contactName, tags } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    const count = await prisma.clientSignal.count({ where: { projectId: id } });

    const signal = await prisma.clientSignal.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        source: source || "WECHAT",
        contactName: contactName?.trim() || null,
        tags: tags || null,
        sortOrder: count,
        projectId: id,
        createdById: userId,
      },
      include: { createdBy: { select: { name: true } }, actionItems: true },
    });

    return NextResponse.json(signal, { status: 201 });
  } catch (error) {
    console.error("Failed to create signal:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(["ADMIN", "MANAGER"]);
    if (isAuthError(authResult)) return authResult;
    const { id } = await params;
    const body = await request.json();
    const { signalId, notes } = body;

    if (!signalId) {
      return NextResponse.json({ error: "signalId required" }, { status: 400 });
    }

    // Verify signal belongs to this project
    const existing = await prisma.clientSignal.findUnique({ where: { id: signalId }, select: { projectId: true } });
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const signal = await prisma.clientSignal.update({
      where: { id: signalId },
      data: { notes: notes ?? null },
    });

    return NextResponse.json(signal);
  } catch (error) {
    console.error("Failed to update signal:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

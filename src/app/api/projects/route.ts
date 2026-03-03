import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: true,
        primaryContact: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { estimates: true } },
        invoices: { where: { deletedAt: null }, select: { id: true, status: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, title, primaryContactId, assignedToId, startDate, endDate, notes } = body;

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Auto-generate project number: PRJ-YYYY-NNN
    const year = new Date().getFullYear();
    const prefix = `PRJ-${year}-`;
    const lastProject = await prisma.project.findFirst({
      where: { projectNumber: { startsWith: prefix } },
      orderBy: { projectNumber: "desc" },
      select: { projectNumber: true },
    });
    let seq = 1;
    if (lastProject) {
      const parts = lastProject.projectNumber.split("-");
      seq = (parseInt(parts[2] || "0", 10) || 0) + 1;
    }
    const projectNumber = `${prefix}${String(seq).padStart(3, "0")}`;

    const project = await prisma.project.create({
      data: {
        projectNumber,
        title: title.trim(),
        status: "INQUIRY_RECEIVED",
        clientId,
        primaryContactId: primaryContactId || null,
        assignedToId: assignedToId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes?.trim() || null,
      },
      include: {
        client: true,
        primaryContact: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });

    await logActivity({
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project.id,
      entityLabel: project.projectNumber,
      description: `Created project ${project.projectNumber}`,
      userId: (session.user as any).id,
      projectId: project.id,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

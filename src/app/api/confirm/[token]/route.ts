import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch scope version details for the confirmation page
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const version = await prisma.scopeVersion.findUnique({
      where: { confirmToken: token },
      include: {
        inquiry: {
          include: {
            project: {
              select: {
                title: true,
                projectNumber: true,
                client: { select: { company: true } },
              },
            },
          },
        },
        createdBy: { select: { name: true } },
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    return NextResponse.json({
      id: version.id,
      content: version.content,
      version: version.version,
      createdAt: version.createdAt,
      createdBy: version.createdBy?.name || "Team",
      confirmed: version.confirmed,
      confirmedAt: version.confirmedAt,
      confirmedByName: version.confirmedByName,
      project: {
        title: version.inquiry.project.title,
        projectNumber: version.inquiry.project.projectNumber,
        company: version.inquiry.project.client.company,
      },
    });
  } catch (error) {
    console.error("Failed to fetch confirmation:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

// POST: Client confirms the scope
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }

    const version = await prisma.scopeVersion.findUnique({
      where: { confirmToken: token },
    });

    if (!version) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    if (version.confirmed) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
    }

    const updated = await prisma.scopeVersion.update({
      where: { id: version.id },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedByName: name.trim(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to confirm:", error);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}

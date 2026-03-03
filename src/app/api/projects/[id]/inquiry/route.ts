import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const inquiry = await prisma.inquiry.findUnique({
      where: { projectId: id },
      include: { serviceModules: { orderBy: { sortOrder: "asc" } } },
    });

    if (!inquiry) {
      return NextResponse.json(null);
    }

    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Failed to fetch inquiry:", error);
    return NextResponse.json({ error: "Failed to fetch inquiry" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const inquiry = await prisma.inquiry.findUnique({ where: { projectId: id } });
    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    // Explicitly delete service modules before inquiry (safety for FK constraints)
    await prisma.inquiryServiceModule.deleteMany({ where: { inquiryId: inquiry.id } });
    await prisma.inquiry.delete({ where: { id: inquiry.id } });

    await logActivity({
      action: "DELETE",
      entityType: "INQUIRY",
      entityId: inquiry.id,
      description: `Deleted project brief`,
      userId: (session.user as any).id,
      projectId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inquiry:", error);
    return NextResponse.json({ error: "Failed to delete inquiry" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const {
      background,
      objectives,
      methodology,
      targetAudience,
      screeningCriteria,
      participantCount,
      segments,
      scope,
      timeline,
      desiredStartDate,
      desiredEndDate,
      indicativeBudget,
      currency,
      source,
      sourceDetail,
      rawContent,
      serviceModules,
    } = body;

    const inquiryData = {
      background: background ?? null,
      objectives: objectives ?? null,
      methodology: methodology ?? null,
      targetAudience: targetAudience ?? null,
      screeningCriteria: screeningCriteria ?? null,
      participantCount: participantCount ?? null,
      segments: segments ?? null,
      scope: scope ?? null,
      timeline: timeline ?? null,
      desiredStartDate: desiredStartDate ? new Date(desiredStartDate) : null,
      desiredEndDate: desiredEndDate ? new Date(desiredEndDate) : null,
      indicativeBudget: indicativeBudget ?? null,
      currency: currency || "USD",
      source: source || "OTHER",
      sourceDetail: sourceDetail ?? null,
      rawContent: rawContent ?? null,
    };

    const inquiry = await prisma.$transaction(async (tx) => {
      // Upsert inquiry
      const existing = await tx.inquiry.findUnique({ where: { projectId: id } });

      let inq;
      if (existing) {
        // Delete old service modules
        await tx.inquiryServiceModule.deleteMany({ where: { inquiryId: existing.id } });
        inq = await tx.inquiry.update({
          where: { projectId: id },
          data: inquiryData,
        });
      } else {
        inq = await tx.inquiry.create({
          data: { ...inquiryData, projectId: id },
        });
      }

      // Create new service modules
      if (serviceModules && serviceModules.length > 0) {
        await tx.inquiryServiceModule.createMany({
          data: serviceModules.map(
            (
              m: {
                moduleType: string;
                quantity?: number;
                unit?: string;
                unitPrice?: number;
                notes?: string;
                sortOrder?: number;
              },
              index: number
            ) => ({
              inquiryId: inq.id,
              moduleType: m.moduleType,
              quantity: m.quantity ?? null,
              unit: m.unit ?? null,
              unitPrice: m.unitPrice ?? null,
              notes: m.notes ?? null,
              sortOrder: m.sortOrder ?? index,
            })
          ),
        });
      }

      return tx.inquiry.findUnique({
        where: { id: inq.id },
        include: { serviceModules: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await logActivity({
      action: "UPDATE",
      entityType: "INQUIRY",
      entityId: inquiry!.id,
      description: `Updated project brief`,
      userId: (session.user as any).id,
      projectId: id,
    });

    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Failed to upsert inquiry:", error);
    return NextResponse.json({ error: "Failed to save inquiry" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { EstimatePDF } from "@/lib/pdf/estimate-pdf";
import React from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [estimate, businessProfile] = await Promise.all([
      prisma.estimate.findUnique({
        where: { id },
        include: {
          project: { include: { client: true } },
          phases: {
            include: { lineItems: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.businessProfile.findUnique({ where: { id: "default" } }),
    ]);

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const business = businessProfile ?? {
      name: "UBInsights LLC",
      address: null,
      email: null,
      phone: null,
      tagline: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(EstimatePDF, { estimate, business }) as any);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${estimate.estimateNumber}.pdf"`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to generate estimate PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

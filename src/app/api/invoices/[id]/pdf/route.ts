import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf/invoice-pdf";
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

    const [invoice, businessProfile] = await Promise.all([
      prisma.invoice.findUnique({
        where: { id },
        include: {
          project: { include: { client: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.businessProfile.findUnique({ where: { id: "default" } }),
    ]);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const business = businessProfile ?? {
      name: "UBInsights LLC",
      address: null,
      email: null,
      phone: null,
      tagline: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(InvoicePDF, { invoice, business }) as any);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

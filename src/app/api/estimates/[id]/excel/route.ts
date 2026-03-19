import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { currencySymbol } from "@/lib/currency";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

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
    };

    const sym = currencySymbol(estimate.currency);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = business.name;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Estimate");

    // Column widths
    sheet.columns = [
      { width: 40 }, // A - Description
      { width: 12 }, // B - Unit
      { width: 10 }, // C - Qty
      { width: 15 }, // D - Unit Price
      { width: 15 }, // E - Total
    ];

    const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    const tableHeaderFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    const tableHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF374151" }, size: 9 };
    const thinBorder: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE5E7EB" } };

    // === Company header ===
    const companyRow = sheet.addRow([business.name]);
    companyRow.font = { bold: true, size: 16, color: { argb: "FF111827" } };
    sheet.mergeCells(companyRow.number, 1, companyRow.number, 5);

    if (business.address) {
      const r = sheet.addRow([business.address]);
      r.font = { size: 9, color: { argb: "FF6B7280" } };
      sheet.mergeCells(r.number, 1, r.number, 5);
    }
    if (business.email) {
      const r = sheet.addRow([business.email]);
      r.font = { size: 9, color: { argb: "FF6B7280" } };
      sheet.mergeCells(r.number, 1, r.number, 5);
    }
    if (business.phone) {
      const r = sheet.addRow([business.phone]);
      r.font = { size: 9, color: { argb: "FF6B7280" } };
      sheet.mergeCells(r.number, 1, r.number, 5);
    }

    sheet.addRow([]);

    // === Estimate title row ===
    const titleLabel = `ESTIMATE — ${estimate.estimateNumber}${estimate.label ? ` — ${estimate.label}` : ""}`;
    const titleRow = sheet.addRow([titleLabel]);
    titleRow.font = { bold: true, size: 14, color: { argb: "FF374151" } };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, 5);

    const dateRow = sheet.addRow([`Date: ${new Date(estimate.updatedAt).toLocaleDateString()}`]);
    dateRow.font = { size: 9, color: { argb: "FF6B7280" } };
    sheet.mergeCells(dateRow.number, 1, dateRow.number, 5);

    sheet.addRow([]);

    // === Client info ===
    const clientHeaderRow = sheet.addRow(["CLIENT DETAILS"]);
    clientHeaderRow.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    clientHeaderRow.fill = headerFill;
    sheet.mergeCells(clientHeaderRow.number, 1, clientHeaderRow.number, 5);

    const addInfoRow = (label: string, value: string) => {
      const r = sheet.addRow([label, value]);
      r.getCell(1).font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
      r.getCell(2).font = { size: 9, color: { argb: "FF374151" } };
      sheet.mergeCells(r.number, 2, r.number, 5);
      r.eachCell((cell) => {
        cell.border = { bottom: thinBorder };
      });
    };

    addInfoRow("Client:", estimate.project.client.company);
    addInfoRow("Project:", estimate.projectName || estimate.title);
    if (estimate.address) addInfoRow("Address:", estimate.address);
    if (estimate.validUntil) {
      addInfoRow("Valid Until:", new Date(estimate.validUntil).toLocaleDateString());
    }

    sheet.addRow([]);

    // === Phases & Line Items ===
    let subtotal = 0;

    for (const phase of estimate.phases) {
      const phaseTotal = phase.lineItems.reduce(
        (sum, li) => sum + li.quantity * li.unitPrice,
        0
      );
      subtotal += phaseTotal;

      // Phase header
      const phaseRow = sheet.addRow([phase.name, "", "", "", `${sym} ${phaseTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]);
      phaseRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
      });
      phaseRow.getCell(5).alignment = { horizontal: "right" };
      sheet.mergeCells(phaseRow.number, 1, phaseRow.number, 4);

      // Table header
      const thRow = sheet.addRow(["Description", "Unit", "Qty", "Unit Price", "Total"]);
      thRow.eachCell((cell) => {
        cell.fill = tableHeaderFill;
        cell.font = tableHeaderFont;
        cell.border = { bottom: thinBorder };
      });
      thRow.getCell(3).alignment = { horizontal: "right" };
      thRow.getCell(4).alignment = { horizontal: "right" };
      thRow.getCell(5).alignment = { horizontal: "right" };

      // Line items
      for (const item of phase.lineItems) {
        const lineTotal = item.quantity * item.unitPrice;
        const desc = item.notes ? `${item.description}\n${item.notes}` : item.description;
        const row = sheet.addRow([
          desc,
          item.unit,
          item.quantity,
          item.unitPrice,
          lineTotal,
        ]);
        row.getCell(1).alignment = { wrapText: true, vertical: "top" };
        row.getCell(3).alignment = { horizontal: "right" };
        row.getCell(4).alignment = { horizontal: "right" };
        row.getCell(4).numFmt = `"${sym} "#,##0.00`;
        row.getCell(5).alignment = { horizontal: "right" };
        row.getCell(5).numFmt = `"${sym} "#,##0.00`;
        row.getCell(5).font = { bold: true };
        row.eachCell((cell) => {
          cell.border = { bottom: thinBorder };
        });
      }

      sheet.addRow([]);
    }

    // === Totals ===
    const taxAmount = subtotal * (estimate.taxRate / 100);
    const total = subtotal + taxAmount - estimate.discount;

    const addTotalRow = (label: string, value: number, opts?: { bold?: boolean; dark?: boolean; red?: boolean }) => {
      const r = sheet.addRow(["", "", "", label, value]);
      r.getCell(4).font = { size: 10, color: { argb: opts?.dark ? "FFFFFFFF" : "FF6B7280" }, bold: opts?.bold };
      r.getCell(4).alignment = { horizontal: "right" };
      r.getCell(5).numFmt = `"${sym} "#,##0.00`;
      r.getCell(5).alignment = { horizontal: "right" };
      r.getCell(5).font = {
        size: opts?.bold ? 12 : 10,
        bold: opts?.bold,
        color: { argb: opts?.dark ? "FFFFFFFF" : opts?.red ? "FFEF4444" : "FF374151" },
      };
      if (opts?.dark) {
        r.getCell(4).fill = headerFill;
        r.getCell(5).fill = headerFill;
      }
      r.eachCell((cell) => {
        cell.border = { bottom: thinBorder };
      });
    };

    addTotalRow("Subtotal", subtotal);
    if (estimate.taxRate > 0) {
      addTotalRow(`Tax (${estimate.taxRate}%)`, taxAmount);
    }
    if (estimate.discount > 0) {
      addTotalRow("Discount", -estimate.discount, { red: true });
    }
    addTotalRow("TOTAL", total, { bold: true, dark: true });

    sheet.addRow([]);

    // === Notes ===
    if (estimate.clientNotes) {
      const notesHeader = sheet.addRow(["NOTES"]);
      notesHeader.font = { bold: true, size: 9, color: { argb: "FF374151" } };
      sheet.mergeCells(notesHeader.number, 1, notesHeader.number, 5);
      const notesRow = sheet.addRow([estimate.clientNotes]);
      notesRow.font = { size: 9, color: { argb: "FF6B7280" } };
      notesRow.getCell(1).alignment = { wrapText: true };
      sheet.mergeCells(notesRow.number, 1, notesRow.number, 5);
      sheet.addRow([]);
    }

    if (estimate.notes) {
      const notesHeader = sheet.addRow(["INTERNAL NOTES"]);
      notesHeader.font = { bold: true, size: 9, color: { argb: "FF374151" } };
      sheet.mergeCells(notesHeader.number, 1, notesHeader.number, 5);
      const notesRow = sheet.addRow([estimate.notes]);
      notesRow.font = { size: 9, color: { argb: "FF6B7280" } };
      notesRow.getCell(1).alignment = { wrapText: true };
      sheet.mergeCells(notesRow.number, 1, notesRow.number, 5);
      sheet.addRow([]);
    }

    // === Wiring Instructions ===
    const wiringHeader = sheet.addRow(["WIRING INSTRUCTIONS"]);
    wiringHeader.font = headerFont;
    wiringHeader.fill = headerFill;
    sheet.mergeCells(wiringHeader.number, 1, wiringHeader.number, 5);

    const wiringData = [
      ["Beneficiary", "UBINSIGHTS LLC"],
      ["Bank", "Bank of America"],
      ["Account No.", "325201682368"],
      ["Routing No.", "026009593"],
      ["SWIFT Code", "BOFAUS3N"],
      ["Bank Address", "Bank of America, N.A., 222 Broadway, New York, NY 10038"],
      ["Beneficiary Address", "28016 Ridgebluff Ct., Rancho Palos Verdes, CA 90275"],
    ];
    for (const [label, value] of wiringData) {
      const r = sheet.addRow([label, value]);
      r.getCell(1).font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
      r.getCell(2).font = { size: 9, color: { argb: "FF374151" } };
      sheet.mergeCells(r.number, 2, r.number, 5);
      r.eachCell((cell) => {
        cell.border = { bottom: thinBorder };
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer as ArrayBuffer);

    const filename = `${estimate.estimateNumber}.xlsx`;
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to generate estimate Excel:", error);
    return NextResponse.json({ error: "Failed to generate Excel" }, { status: 500 });
  }
}

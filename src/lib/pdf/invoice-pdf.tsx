import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "./register-fonts";

registerFonts();

const COLORS = {
  ink900: "#0F1729",
  ink700: "#525873",
  ink600: "#5C6378",          // replaces #82869C and #A4A6B5; ~5.6:1 on white (AA at all sizes)
  accent: "#D9522B",
  discount: "#A85614",
  hairline: "#E8E5DD",
  hairlineStrong: "#1F2A44",  // new — rule above totals final + below table header + above wire panel
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    fontSize: 10,
    paddingTop: 48,
    paddingHorizontal: 44,
    paddingBottom: 44,
    color: COLORS.ink900,
    backgroundColor: "#ffffff",
  },

  // -------- HEADER --------
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
  },
  companyDetail: {
    fontSize: 10,
    color: COLORS.ink700,
    marginTop: 2,
  },
  headerMeta: { alignItems: "flex-end" },
  invoiceEyebrow: {
    fontSize: 9.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink600,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  invoiceNumber: {
    fontSize: 18,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
    marginTop: 3,
  },
  metaLine: {
    fontSize: 9,
    color: COLORS.ink600,
    marginTop: 4,
  },
  metaValue: {
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
  },

  // -------- DIVIDERS --------
  hairlineRow: {
    height: 1,
    backgroundColor: COLORS.hairline,
    marginVertical: 14,
  },

  // -------- BILL TO / PROJECT --------
  billGrid: {
    flexDirection: "row",
    gap: 28,
  },
  billCol: { flex: 1 },
  fieldLabel: {
    fontSize: 8.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink600,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  fieldHeadline: {
    fontSize: 18,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
    lineHeight: 1.15,
  },
  fieldLine: {
    fontSize: 10,
    color: COLORS.ink700,
    marginTop: 1,
    lineHeight: 1.35,
  },

  // -------- TABLE --------
  tableHead: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1.4,
    borderBottomColor: COLORS.hairlineStrong,
    marginTop: 22,
  },
  tableRow: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  colDesc:  { flex: 5, paddingRight: 8 },
  colQty:   { flex: 1, textAlign: "right", paddingRight: 4 },
  colPrice: { flex: 2, textAlign: "right", paddingRight: 4 },
  colTotal: { flex: 2, textAlign: "right" },
  headerCell: {
    fontSize: 8.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink600,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  cellText:     { fontSize: 10, color: COLORS.ink700 },
  cellStrong:   { fontSize: 10, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: COLORS.ink900 },

  // -------- TOTALS (open list) --------
  totalsWrap: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsList: { width: 280 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 3,
    paddingBottom: 3,
  },
  totalsLabel: { fontSize: 10, color: COLORS.ink600 },
  totalsValue: { fontSize: 10, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: COLORS.ink900 },
  totalsDiscount: { fontSize: 10, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: COLORS.discount },
  totalsFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1.4,
    borderTopColor: COLORS.hairlineStrong,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  totalsFinalValue: {
    fontSize: 30,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.accent,
    lineHeight: 1.0,
  },

  // -------- NOTES --------
  notesSection: { marginTop: 18 },
  notesTitle: {
    fontSize: 8.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink600,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: COLORS.ink700,
    lineHeight: 1.4,
  },

  // -------- SPACER (pushes wire panel to bottom) --------
  spacer: { flexGrow: 1, minHeight: 24 },

  // -------- WIRE TRANSFER (bottom-anchored, no chip) --------
  wireBlock: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineStrong,
    marginBottom: 16,
  },
  wireTitle: {
    fontSize: 9.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink900,
    textTransform: "none",
    letterSpacing: 0,
    marginBottom: 8,
    lineHeight: 1.1,
  },
  wireGrid: {
    flexDirection: "row",
    gap: 28,
  },
  wireCol: { flex: 1, flexDirection: "column" },
  wireRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  wireRowFirst: {
    flexDirection: "row",
    marginTop: 0,
  },
  wireRowAddressGap: {
    flexDirection: "row",
    marginTop: 8,
  },
  wireKey: {
    width: 88,
    fontSize: 8.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold" as const,
    color: COLORS.ink600,
    textTransform: "none",
    letterSpacing: 0,
    lineHeight: 1.35,
  },
  wireVal: {
    flex: 1,
    fontSize: 8.5,
    color: COLORS.ink900,
    lineHeight: 1.35,
  },

  // -------- FOOTER --------
  footer: {
    position: "absolute",
    bottom: 18,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    paddingTop: 6,
  },
  footerText: { fontSize: 8.5, color: COLORS.ink600 },
});

export interface BusinessProfileData {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  tagline: string | null;
}

export interface InvoicePDFData {
  invoiceNumber: string;
  status: string;
  currency: string;
  issuedDate: Date | null;
  dueDate: Date | null;
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  exchangeRate: number | null;
  notes: string | null;
  contactEmail: string | null;
  project: {
    title: string;
    client: { company: string; email: string | null; billingName: string | null; billingAddress: string | null; billingEmail: string | null };
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    CNY: "¥",
    EUR: "€",
    GBP: "£",
    HKD: "HK$",
    JPY: "¥",
  };
  return symbols[currency] ?? currency + " ";
}

function fmt(n: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoicePDF({
  invoice,
  business,
}: {
  invoice: InvoicePDFData;
  business: BusinessProfileData;
}) {
  const currency = invoice.currency || "USD";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{business.name}</Text>
            {business.address && <Text style={styles.companyDetail}>{business.address}</Text>}
            {business.email && <Text style={styles.companyDetail}>{business.email}</Text>}
            {business.phone && <Text style={styles.companyDetail}>{business.phone}</Text>}
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.invoiceEyebrow}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            {invoice.issuedDate && (
              <Text style={styles.metaLine}>
                Issued{" "}
                <Text style={styles.metaValue}>
                  {new Date(invoice.issuedDate).toLocaleDateString()}
                </Text>
              </Text>
            )}
            {invoice.dueDate && (
              <Text style={styles.metaLine}>
                Due{" "}
                <Text style={styles.metaValue}>
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </Text>
              </Text>
            )}
          </View>
        </View>

        {/* Faint divider before bill-to */}
        <View style={styles.hairlineRow} />

        {/* Bill To / Project */}
        <View style={styles.billGrid}>
          <View style={styles.billCol}>
            <Text style={styles.fieldLabel}>Billed to</Text>
            <Text style={styles.fieldHeadline}>
              {invoice.project.client.billingName || invoice.project.client.company}
            </Text>
            {invoice.project.client.billingName && (
              <Text style={styles.fieldLine}>{invoice.project.client.company}</Text>
            )}
            {invoice.project.client.billingAddress && (
              <Text style={styles.fieldLine}>{invoice.project.client.billingAddress}</Text>
            )}
            {(invoice.project.client.billingEmail || invoice.project.client.email) && (
              <Text style={styles.fieldLine}>
                {invoice.project.client.billingEmail || invoice.project.client.email}
              </Text>
            )}
          </View>
          <View style={styles.billCol}>
            <Text style={styles.fieldLabel}>Project</Text>
            <Text style={styles.fieldHeadline}>{invoice.project.title}</Text>
            {invoice.contactEmail && (
              <Text style={styles.fieldLine}>Contact: {invoice.contactEmail}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHead}>
          <Text style={[styles.headerCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.headerCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.headerCell, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.headerCell, styles.colTotal]}>Total</Text>
        </View>
        {invoice.lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.cellStrong, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.cellText, styles.colPrice]}>{fmt(item.unitPrice, currency)}</Text>
            <Text style={[styles.cellStrong, styles.colTotal]}>{fmt(item.total, currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsList}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(invoice.subtotal, currency)}</Text>
            </View>
            {invoice.discount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsDiscount}>-{fmt(invoice.discount, currency)}</Text>
              </View>
            )}
            {invoice.taxRate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({invoice.taxRate}%)</Text>
                <Text style={styles.totalsValue}>{fmt(invoice.tax, currency)}</Text>
              </View>
            )}
            {invoice.exchangeRate && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Exchange rate</Text>
                <Text style={styles.totalsValue}>1 USD = {invoice.exchangeRate} CNY</Text>
              </View>
            )}
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total Due</Text>
              <Text style={styles.totalsFinalValue}>{fmt(invoice.total, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Spacer pushes wire panel to the bottom of the page */}
        <View style={styles.spacer} />

        {/* Wire transfer (bottom-anchored) */}
        <View style={styles.wireBlock}>
          <Text style={styles.wireTitle}>Wire transfer details</Text>
          <View style={styles.wireGrid}>
            {/* Left column: short fields */}
            <View style={styles.wireCol}>
              <View style={styles.wireRowFirst}>
                <Text style={styles.wireKey}>Beneficiary</Text>
                <Text style={styles.wireVal}>UBINSIGHTS LLC</Text>
              </View>
              <View style={styles.wireRow}>
                <Text style={styles.wireKey}>Bank</Text>
                <Text style={styles.wireVal}>Bank of America</Text>
              </View>
              <View style={styles.wireRow}>
                <Text style={styles.wireKey}>Account No.</Text>
                <Text style={styles.wireVal}>325201682368</Text>
              </View>
              <View style={styles.wireRow}>
                <Text style={styles.wireKey}>Routing No.</Text>
                <Text style={styles.wireVal}>026009593</Text>
              </View>
              <View style={styles.wireRow}>
                <Text style={styles.wireKey}>SWIFT Code</Text>
                <Text style={styles.wireVal}>BOFAUS3N</Text>
              </View>
            </View>

            {/* Right column: addresses */}
            <View style={styles.wireCol}>
              <View style={styles.wireRowFirst}>
                <Text style={styles.wireKey}>Bank Address</Text>
                <Text style={styles.wireVal}>
                  Bank of America, N.A., 222 Broadway, New York, NY 10038
                </Text>
              </View>
              <View style={styles.wireRowAddressGap}>
                <Text style={styles.wireKey}>Beneficiary Address</Text>
                <Text style={styles.wireVal}>
                  28016 Ridgebluff Ct., Rancho Palos Verdes, CA 90275
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{business.name} — {invoice.invoiceNumber}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}

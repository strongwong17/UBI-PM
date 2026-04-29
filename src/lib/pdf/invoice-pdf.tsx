import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "./register-fonts";

registerFonts();

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    fontSize: 10,
    padding: 40,
    color: "#0F1729",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  companyName: {
    fontSize: 20,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
  },
  companyDetail: {
    fontSize: 9,
    color: "#82869C",
    marginTop: 1,
  },
  invoiceTitle: {
    fontSize: 18,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#D9522B",
    textAlign: "right",
    letterSpacing: 0.6,
  },
  invoiceNumber: {
    fontSize: 11,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    textAlign: "right",
    marginTop: 4,
  },
  metaText: {
    fontSize: 9,
    color: "#82869C",
    textAlign: "right",
    marginTop: 2,
  },
  // Billing section
  billingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    backgroundColor: "#F0EDE5",
    padding: 14,
    borderRadius: 8,
  },
  billingLabel: {
    fontSize: 8,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#82869C",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  billingName: {
    fontSize: 12,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
  },
  billingText: {
    fontSize: 9,
    color: "#525873",
    marginTop: 2,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FAFAF6",
    padding: "8 10",
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  tableRow: {
    flexDirection: "row",
    padding: "7 10",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  colDesc: { flex: 5, paddingRight: 8 },
  colQty: { flex: 1, textAlign: "right", paddingRight: 4 },
  colPrice: { flex: 2, textAlign: "right", paddingRight: 4 },
  colTotal: { flex: 2, textAlign: "right" },
  headerCell: {
    fontSize: 8,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#A4A6B5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cellText: { fontSize: 9, color: "#525873" },
  cellBold: { fontSize: 9, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: "#0F1729" },
  // Totals
  totalsSection: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsBox: {
    width: 220,
    borderWidth: 1,
    borderColor: "#E8E5DD",
    borderRadius: 8,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "6 12",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  totalsLabel: { fontSize: 9, color: "#82869C" },
  totalsValue: { fontSize: 9, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: "#525873" },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "10 12",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#D8D4C8",
  },
  totalsFinalLabel: { fontSize: 11, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: "#0F1729" },
  totalsFinalValue: { fontSize: 12, fontFamily: "NotoSansSC", fontWeight: "bold" as const, color: "#D9522B" },
  // Notes
  notesSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    paddingTop: 14,
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  notesText: { fontSize: 9, color: "#525873", lineHeight: 1.5 },
  // Wiring
  wiringSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    paddingTop: 14,
  },
  wiringBox: {
    borderWidth: 1,
    borderColor: "#E8E5DD",
    borderRadius: 8,
    overflow: "hidden",
  },
  wiringBoxHeader: {
    backgroundColor: "#FAFAF6",
    padding: "6 10",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  wiringBoxTitle: {
    fontSize: 9,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  wiringRow: {
    flexDirection: "row",
    padding: "4 10",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  wiringLabel: {
    fontSize: 8,
    color: "#82869C",
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    width: 100,
  },
  wiringValue: {
    fontSize: 8,
    color: "#525873",
    flex: 1,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: "#A4A6B5" },
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
            {business.address && (
              <Text style={styles.companyDetail}>{business.address}</Text>
            )}
            {business.email && (
              <Text style={styles.companyDetail}>{business.email}</Text>
            )}
            {business.phone && (
              <Text style={styles.companyDetail}>{business.phone}</Text>
            )}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            {invoice.issuedDate && (
              <Text style={styles.metaText}>
                Issued: {new Date(invoice.issuedDate).toLocaleDateString()}
              </Text>
            )}
            {invoice.dueDate && (
              <Text style={styles.metaText}>
                Due: {new Date(invoice.dueDate).toLocaleDateString()}
              </Text>
            )}
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        {/* Billing */}
        <View style={styles.billingSection}>
          <View>
            <Text style={styles.billingLabel}>Bill To</Text>
            <Text style={styles.billingName}>
              {invoice.project.client.billingName || invoice.project.client.company}
            </Text>
            {invoice.project.client.billingName && (
              <Text style={styles.billingText}>{invoice.project.client.company}</Text>
            )}
            {invoice.project.client.billingAddress && (
              <Text style={styles.billingText}>{invoice.project.client.billingAddress}</Text>
            )}
            {(invoice.project.client.billingEmail || invoice.project.client.email) && (
              <Text style={styles.billingText}>
                {invoice.project.client.billingEmail || invoice.project.client.email}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.billingLabel}>Project</Text>
            <Text style={styles.billingName}>{invoice.project.title}</Text>
            {invoice.contactEmail && (
              <Text style={styles.billingText}>Contact: {invoice.contactEmail}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.headerCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.headerCell, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.headerCell, styles.colTotal]}>Total</Text>
        </View>
        {invoice.lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colDesc]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.cellText, styles.colPrice]}>{fmt(item.unitPrice, currency)}</Text>
            <Text style={[styles.cellBold, styles.colTotal]}>{fmt(item.total, currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(invoice.subtotal, currency)}</Text>
            </View>
            {invoice.discount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={[styles.totalsValue, { color: "#A85614" }]}>-{fmt(invoice.discount, currency)}</Text>
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
                <Text style={styles.totalsLabel}>Exchange Rate</Text>
                <Text style={styles.totalsValue}>1 USD = {invoice.exchangeRate} CNY</Text>
              </View>
            )}
            <View style={styles.totalsFinalRow}>
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

        {/* Wiring Instructions */}
        <View style={styles.wiringSection}>
          <View style={styles.wiringBox}>
            <View style={styles.wiringBoxHeader}>
              <Text style={styles.wiringBoxTitle}>Wiring Instructions</Text>
            </View>
            {[
              ["Beneficiary", "UBINSIGHTS LLC"],
              ["Bank", "Bank of America"],
              ["Account No.", "325201682368"],
              ["Routing No.", "026009593"],
              ["SWIFT Code", "BOFAUS3N"],
              ["Bank Address", "Bank of America, N.A., 222 Broadway, New York, NY 10038"],
              ["Beneficiary Address", "28016 Ridgebluff Ct., Rancho Palos Verdes, CA 90275"],
            ].map(([label, value]) => (
              <View key={label} style={styles.wiringRow}>
                <Text style={styles.wiringLabel}>{label}</Text>
                <Text style={styles.wiringValue}>{value}</Text>
              </View>
            ))}
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

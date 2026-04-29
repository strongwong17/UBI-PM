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
  // Header
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
  docTitle: {
    textAlign: "right",
  },
  docTitleText: {
    fontSize: 18,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#D9522B",
    letterSpacing: 0.6,
  },
  docMeta: {
    fontSize: 9,
    color: "#82869C",
    marginTop: 4,
    textAlign: "right",
  },
  docNumber: {
    fontSize: 11,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    marginTop: 4,
    textAlign: "right",
  },
  // Client info
  clientSection: {
    backgroundColor: "#F0EDE5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clientLabel: {
    fontSize: 8,
    color: "#82869C",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
  },
  clientName: {
    fontSize: 12,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
  },
  clientSub: {
    fontSize: 9,
    color: "#525873",
    marginTop: 2,
  },
  // Phase
  phaseHeader: {
    backgroundColor: "#FAFAF6",
    padding: "8 10",
    marginTop: 16,
    marginBottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  phaseName: {
    fontSize: 10,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  phaseTotal: {
    fontSize: 10,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FAFAF6",
    padding: "6 10",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  tableRow: {
    flexDirection: "row",
    padding: "6 10",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5DD",
  },
  colDesc: { flex: 4, paddingRight: 8 },
  colUnit: { flex: 1.5, paddingRight: 4 },
  colQty: { flex: 1, textAlign: "right", paddingRight: 4 },
  colPrice: { flex: 1.5, textAlign: "right", paddingRight: 4 },
  colTotal: { flex: 1.5, textAlign: "right" },
  headerCell: {
    fontSize: 8,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#A4A6B5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cellText: { fontSize: 9, color: "#525873" },
  cellNote: { fontSize: 8, color: "#A4A6B5", marginTop: 2 },
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
  totalsValue: { fontSize: 9, color: "#525873", fontFamily: "Helvetica-Bold" },
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
  // Wiring
  wiringSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    paddingTop: 16,
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
  // Notes
  notesSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DD",
    paddingTop: 16,
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: "NotoSansSC", fontWeight: "bold" as const,
    color: "#0F1729",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  notesText: { fontSize: 9, color: "#525873", lineHeight: 1.5 },
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

interface EstimatePDFData {
  estimateNumber: string;
  title: string;
  label: string | null;
  projectName: string | null;
  address: string | null;
  version: number;
  currency: string;
  taxRate: number;
  discount: number;
  notes: string | null;
  clientNotes: string | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    title: string;
    client: { company: string };
  };
  phases: {
    name: string;
    description: string | null;
    lineItems: {
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      notes: string | null;
    }[];
  }[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

function fmt(n: number, currency = "USD") {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EstimatePDF({ estimate, business }: { estimate: EstimatePDFData; business: BusinessProfileData }) {
  const sym = CURRENCY_SYMBOLS[estimate.currency] || estimate.currency;

  const subtotal = estimate.phases.reduce(
    (sum, phase) =>
      sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
    0
  );
  const taxAmount = subtotal * (estimate.taxRate / 100);
  const total = subtotal + taxAmount - estimate.discount;

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
          <View style={styles.docTitle}>
            <Text style={styles.docTitleText}>ESTIMATE</Text>
            <Text style={styles.docMeta}>{new Date(estimate.updatedAt).toLocaleDateString()}</Text>
            <Text style={styles.docNumber}>
              {estimate.estimateNumber}
              {estimate.label ? ` — ${estimate.label}` : ""}
            </Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientSection}>
          <View>
            <Text style={styles.clientLabel}>Prepared For</Text>
            <Text style={styles.clientName}>{estimate.project.client.company}</Text>
            {estimate.address && (
              <Text style={styles.clientSub}>{estimate.address}</Text>
            )}
          </View>
          <View>
            <Text style={styles.clientLabel}>Project</Text>
            <Text style={styles.clientName}>
              {estimate.projectName || estimate.title}
            </Text>
            <Text style={styles.clientSub}>{estimate.project.title}</Text>
            {estimate.validUntil && (
              <Text style={styles.clientSub}>
                Valid until {new Date(estimate.validUntil).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        {/* Phases */}
        {estimate.phases.map((phase) => {
          const phaseTotal = phase.lineItems.reduce(
            (sum, li) => sum + li.quantity * li.unitPrice,
            0
          );
          return (
            <View key={phase.name}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseName}>{phase.name}</Text>
                <Text style={styles.phaseTotal}>{fmt(phaseTotal, estimate.currency)}</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.colDesc]}>Description</Text>
                <Text style={[styles.headerCell, styles.colUnit]}>Unit</Text>
                <Text style={[styles.headerCell, styles.colQty]}>Qty</Text>
                <Text style={[styles.headerCell, styles.colPrice]}>Unit Price</Text>
                <Text style={[styles.headerCell, styles.colTotal]}>Total</Text>
              </View>
              {phase.lineItems.map((item, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={styles.colDesc}>
                    <Text style={styles.cellText}>{item.description}</Text>
                    {item.notes && <Text style={styles.cellNote}>{item.notes}</Text>}
                  </View>
                  <Text style={[styles.cellText, styles.colUnit]}>{item.unit}</Text>
                  <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
                  <Text style={[styles.cellText, styles.colPrice]}>
                    {sym} {item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.cellBold, styles.colTotal]}>
                    {sym} {(item.quantity * item.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(subtotal, estimate.currency)}</Text>
            </View>
            {estimate.taxRate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({estimate.taxRate}%)</Text>
                <Text style={styles.totalsValue}>{fmt(taxAmount, estimate.currency)}</Text>
              </View>
            )}
            {estimate.discount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={[styles.totalsValue, { color: "#A85614" }]}>
                  − {fmt(estimate.discount, estimate.currency)}
                </Text>
              </View>
            )}
            <View style={styles.totalsFinalRow}>
              <Text style={styles.totalsFinalLabel}>Total</Text>
              <Text style={styles.totalsFinalValue}>{fmt(total, estimate.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {(estimate.notes || estimate.clientNotes) && (
          <View style={styles.notesSection}>
            {estimate.clientNotes && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text style={styles.notesText}>{estimate.clientNotes}</Text>
              </View>
            )}
            {estimate.notes && (
              <View>
                <Text style={styles.notesTitle}>Internal Notes</Text>
                <Text style={styles.notesText}>{estimate.notes}</Text>
              </View>
            )}
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
          <Text style={styles.footerText}>{business.name} — Confidential</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
}

# Invoice PDF Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `InvoicePDF` look with a contrast-fixed, typographically-laddered redesign — AA-compliant grays, a four-tier type ladder, "Total Due" as the focal point, and a bottom-anchored wire-transfer panel.

**Architecture:** Single-file rewrite of `src/lib/pdf/invoice-pdf.tsx`. The data shape (`InvoicePDFData`, `BusinessProfileData`), the `getCurrencySymbol`/`fmt` helpers, the font registration in `register-fonts.ts`, and every call site of `InvoicePDF` are all unchanged. Visual change only.

**Tech Stack:** `@react-pdf/renderer` v4 with `StyleSheet.create`. The font family `NotoSansSC` (variable font, registered as regular + bold via `register-fonts.ts`) supplies both weights. `@react-pdf` supports `textTransform`, `letterSpacing`, `fontWeight`, `flexGrow`, and `position: 'absolute'` (already in use in the existing file).

**Reference spec:** `docs/superpowers/specs/2026-05-14-invoice-pdf-redesign-design.md`
**Reference mockup:** `.superpowers/brainstorm/27055-1778791317/content/pdf-approach-a-v10.html` (gitignored; design reference only)

**No automated tests:** the project has no test framework configured. The task ends with `npm run build` and a manual smoke check by generating a real PDF in the running dev server.

---

## File Map

**Modify (only file changed):**
- `src/lib/pdf/invoice-pdf.tsx` — full StyleSheet rewrite + JSX restructure of the `Page` body.

**Unchanged:**
- `src/lib/pdf/register-fonts.ts`
- `src/lib/pdf/estimate-pdf.tsx` (separate follow-up — out of scope here)
- `src/app/api/invoices/[id]/pdf/route.ts` (call site)
- `prisma/schema.prisma`
- `InvoicePDFData` / `BusinessProfileData` interfaces inside `invoice-pdf.tsx`

---

## Task 1: Rewrite `InvoicePDF` per the locked spec

**Files:**
- Modify: `src/lib/pdf/invoice-pdf.tsx`

**Why one commit:** every style and structural change in the redesign is visually interdependent — header weights only balance once the new color palette is in, the totals "Total Due" focal point only works once the box is gone, the wire panel only sits at the bottom once page padding is reduced. Splitting this into N intermediate commits creates N visually-inconsistent intermediate states with no value.

The replacement below renders the full `src/lib/pdf/invoice-pdf.tsx`. Keep `BusinessProfileData`, `InvoicePDFData`, `getCurrencySymbol`, `fmt`, and the `InvoicePDF` export's signature exactly as today; only the `StyleSheet` and the JSX body of the `Page` change.

- [ ] **Step 1: Replace the file**

Full replacement for `src/lib/pdf/invoice-pdf.tsx`:

```tsx
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
    paddingBottom: 44,           // was 40 — trimmed so wire panel sits closer to footer
    color: COLORS.ink900,
    backgroundColor: "#ffffff",
    // No display:flex needed — @react-pdf treats the Page body as a vertical
    // flex container by default. flexGrow on a child still works.
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
    letterSpacing: 1.1,           // ~0.12em at 9.5pt
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
    letterSpacing: 0.7,           // ~0.08em
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
    textTransform: "none",          // explicit: never uppercase
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
    marginTop: 8,                    // larger gap between Bank Address and Beneficiary Address
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
    fontSize: 8.5,                   // same size as the label
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
```

Notes on @react-pdf specifics in the replacement above:

- The wire-transfer beneficiary / bank details are hard-coded in the current PDF (lines 394–401 of the existing file). The replacement keeps that hard-coding for the same fields, just rendered through the new layout. If/when the project introduces a business-profile model that exposes wire details, that's a separate refactor.
- `letterSpacing` in @react-pdf is in **points**, not `em`. The spec calls for ≈0.08em on 8.5pt = ~0.7pt, and ≈0.12em on 9.5pt = ~1.1pt — those are the exact values used in the styles.
- `gap` is supported by `@react-pdf/renderer` ≥ 3.4 (we're on v4). If a runtime error mentions `gap` is unsupported, replace `gap: 28` with `marginRight: 28` on the left column inside the flex row.
- The flex spacer works because `<Page>` lays out its children in a column flex by default. No explicit `display: 'flex'` needed.
- `marginVertical` on the divider is supported.
- The `fixed` prop on the footer keeps it on every page (existing behaviour).

- [ ] **Step 2: Type-check + dev build**

Run: `npm run build`
Expected: clean TypeScript compilation. The static page generation timeouts on `/clients` and `/templates` are pre-existing (no DB at build time) and unrelated — you can ignore those.

If the build fails with a TypeScript error tied to `letterSpacing` types or `gap`, see the notes above.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/invoice-pdf.tsx
git commit -m "feat(invoices): redesign invoice PDF — AA contrast, type ladder, bottom-anchored wire panel"
```

---

## Task 2: Manual smoke test

**Files:** None.

This task runs through the test plan from `docs/superpowers/specs/2026-05-14-invoice-pdf-redesign-design.md`. There is no automated test framework — every check is visual and manual.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Wait for it to listen on `http://localhost:3000`.

- [ ] **Step 2: Generate a representative invoice PDF**

In a separate terminal (or browser):
1. Log into the app at `http://localhost:3000`.
2. Open an invoice that exercises everything: multiple line items (at least one with a long description that wraps), a non-zero discount, an exchange rate (i.e. a CNY invoice or one with `exchangeRate` set), and a notes block. If no such invoice exists, edit one in the app or add fields via Prisma Studio.
3. Click the PDF download (or open `/api/invoices/<invoiceId>/pdf` directly).
4. Open the resulting PDF in Apple Preview AND in Chrome's built-in PDF viewer.

Verify each of these:
- **Header right column:** small "Invoice" eyebrow (uppercase + tracked), then the invoice number as the dominant element below it, then `Issued <date>` / `Due <date>` with the date values bold.
- **Bill-To section:** no cream panel — the bill-to and project blocks sit on white with the client name and project title rendered at headline weight.
- **Table header:** no cream band — just the dark rule below the header row. Header text (Description / Qty / Unit Price / Total) is now readable, not faded.
- **Totals area:** no surrounding box. Right-aligned. "Total Due" lands as a large orange amount (30pt) with a strong dark rule above it.
- **Wire transfer panel:** anchored to the bottom of the page, above the footer. No chip surface. Title "Wire transfer details" in sentence case at 9.5pt bold. Two-column body: short fields on the left, addresses on the right. Labels and values both at 8.5pt, sentence case. The block visually balances — left column has 5 tight rows, right column has 2 entries with a slightly larger gap between them.
- **Footer:** darker than before (the previous `#A4A6B5` was washed out).

- [ ] **Step 3: Multi-page test**

Use Prisma Studio (`npx prisma studio`) to add many line items to an invoice (or paste a long notes block) so the PDF spills to 2+ pages. Regenerate the PDF. Verify:
- The footer renders on every page (`fixed` prop preserved).
- The wire transfer panel appears at the bottom of the LAST page, not every page (it's normal flow, not `fixed`).
- No layout overflow or clipped text.

- [ ] **Step 4: CJK test**

If your test invoice doesn't already include Chinese characters, add some — either to a line item description or to the notes. Regenerate the PDF and confirm NotoSansSC renders them properly (no `□` fallbacks).

- [ ] **Step 5: Spot-check contrast (optional but recommended)**

Screenshot the table header row and the footer text. Run them through any WCAG contrast checker (e.g. webaim.org/resources/contrastchecker/, paste `#5C6378` foreground on `#FFFFFF` background). Confirm ≥4.5:1.

- [ ] **Step 6: Confirm no app-page regression**

Browse to `/invoices/[id]` for the same invoice and confirm the on-screen detail page is unchanged — this PDF redesign should have zero effect on PMT pages.

- [ ] **Step 7: If everything passes, no further commit required**

The smoke test is a verification step, not a code change. If something fails, file a follow-up task or push a fix on top of the Task 1 commit.

---

## Self-review notes

- **Spec coverage:** §1 color tokens → `COLORS` object + `StyleSheet`. §2 type ladder → individual style entries (companyName, fieldHeadline, headerCell, cellText/Strong, totalsLabel/Value, totalsFinalValue, wireKey/Val, etc.). §3 header restructure → JSX in the header `View`. §3 bill-to → no more `billingSection`, replaced by `billGrid`. §3 table → `tableHead` with strong rule, no cream band. §3 totals → no `totalsBox`, just `totalsList` with `totalsFinal` having a strong top rule. §3 notes → `notesSection` retained. §3 wire transfer → `spacer` + `wireBlock` (no chip, dark top rule, sentence-case title, two-column grid). §3 footer → `footer` with `ink600`. §4 unchanged: `InvoicePDFData` / helpers / call sites untouched.
- **Type consistency:** all style references resolve to keys defined in the single `StyleSheet.create` block. Style refs like `[styles.cellStrong, styles.colDesc]` use the array form already used in the current file.
- **No placeholders:** the entire file body is inlined. The only thing the engineer has to do is replace `src/lib/pdf/invoice-pdf.tsx` with the code in Step 1 of Task 1.

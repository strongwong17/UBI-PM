# Invoice PDF Redesign — Hierarchy & Accessible Contrast

**Date:** 2026-05-14
**Status:** Approved (mockup approved in brainstorming companion)

## Problem

The current invoice PDF (`src/lib/pdf/invoice-pdf.tsx`) has two legibility problems and one structural one.

**Failing contrast.** Two of the four gray tokens used for text fall below WCAG AA on the white page:
- `#A4A6B5` (≈2.7:1) — used for table-header cells ("Description / Qty / Unit Price / Total") and footer text. **Fails AA at any size.**
- `#82869C` (≈3.6:1) — used for the "Bill To" / "Project" labels, billing-section meta lines, totals labels, and the issued/due meta text on the header. **Fails AA for normal text** (passes only at 18pt+).

Compounding the issue, the table-header text is also 8pt + uppercase + tracked, which makes the failing contrast harder to read.

**Hierarchy by color, not weight.** The PDF leans almost entirely on size and shade of gray to communicate hierarchy. Almost every element is some cool-gray with two effective weights (regular vs. variable-font bold). The reader gets no clean rungs to climb — the eye has to compare sizes to find the invoice number, the total due, and the line items.

**Identifier competing with category.** The orange "INVOICE" title visually competes with the invoice number for "what is this paper?" attention, even though the recipient already knows it's an invoice — the **number** and the **amount** are what they actually need to find.

## Goals

1. Bring every text-bearing color to **WCAG AA contrast** on the white page (≥4.5:1 for normal text, ≥3:1 for ≥18pt or ≥14pt bold).
2. Establish a clear **four-tier typographic ladder** (Display / Headline / Subhead / Body / Caption) that uses weight, size, and space together — so hierarchy is legible without relying on color alone.
3. Make **Total Due** the unmistakable focal point of the page.
4. Make the **invoice number** — not the word "INVOICE" — the dominant top-right identifier.

## Non-goals

- **No layout reflow** beyond what's enumerated below. Page size stays A4, the section order stays the same, the page mark-up flow is unchanged.
- **No font change.** Keep `NotoSansSC` (the only loaded family — see `src/lib/pdf/register-fonts.ts`). Do not register additional font weight files; the existing regular + variable-bold setup is sufficient.
- **Estimate PDF (`estimate-pdf.tsx`) is out of scope** for this work. It mirrors invoice styling and should get the same treatment in a follow-up so the two documents stay visually consistent — but bundling them here grows the change.
- **No logo support, no signature support, no payment-link QR.** Those are unrelated future features.
- **No accessibility tagging of the PDF** (true PDF accessibility means tagged structure / reading order metadata, which `@react-pdf/renderer` doesn't expose). This redesign improves visual legibility, not screen-reader accessibility.
- **No change to invoice content.** Same fields, same data, same calculations — only the visual treatment changes.

## Design

The validated visual reference is the Approach A mockup at `.superpowers/brainstorm/25704-1778786692/content/pdf-approach-a.html` (kept for reference; not loaded by the app).

### 1. Color tokens

Update the `StyleSheet.create` block in `invoice-pdf.tsx`. The two failing grays are replaced with one new mid-cool-gray that passes AA at every size used; a stronger rule color is added for the totals divider and table-header bottom border.

| Use | Old hex | New hex | Contrast on white |
|-----|---------|---------|--------|
| Primary text (company name, invoice number, line totals, "Total Due" label) | `#0F1729` | unchanged | ≈17.5:1 (AAA) |
| Body text (line item descriptions, billing details, notes) | `#525873` | unchanged | ≈7.5:1 (AAA) |
| Mid gray (labels, captions, meta dates, table-header cells, footer) | `#82869C`, `#A4A6B5` | **`#5C6378`** | ≈5.6:1 (AA at all sizes) |
| Accent (Total Due value, only) | `#D9522B` | unchanged | ≈4.7:1 (AA) |
| Discount value (negative amount) | `#A85614` | unchanged | ≈6.5:1 |
| Faint hairline rules (between line items, around footer) | `#E8E5DD` | unchanged | n/a (non-text) |
| Strong rule (above totals final row, below table header) | n/a | **`#1F2A44`** | n/a (non-text) |
| Cream panel (`#F0EDE5` `billingSection`) | `#F0EDE5` | **removed** | n/a |
| Cream band (`#FAFAF6` `tableHeader` background) | `#FAFAF6` | **removed** | n/a |

Both cream surfaces are deleted. The redesign relies entirely on rules and whitespace for separation. Cream survives nowhere on the page after this change — by design.

### 2. Type ladder

Five tiers, all using `NotoSansSC` with the existing regular / variable-bold setup. Sizes are in pt (PDF unit).

| Tier | Size | Weight | Color | Used for |
|------|------|--------|-------|---------|
| **Display** | 30pt | bold | `#D9522B` | The Total Due value, only. The largest element on the page. |
| **Headline** | 18pt | bold | `#0F1729` | Invoice number (top-right), Bill-To name, Project title, company name (top-left). |
| **Subhead** | 12pt | bold | `#0F1729` | Section names ("Wire transfer details", "Total Due" label). Uppercase + 0.06em tracking on the "Total Due" label, no transform on body subheads. |
| **Body strong** | 10pt | bold | `#0F1729` | Line item descriptions, line item totals, totals breakdown values, wire transfer values. |
| **Body** | 10pt | regular | `#525873` | Billing detail lines, notes body, qty / unit price columns, totals breakdown labels. |
| **Caption** | 8.5pt | bold | `#5C6378` | Section labels ("Billed to", "Project", "Notes"), table header cells, wire transfer row labels, footer. Uppercase + 0.08em tracking. |
| **Eyebrow** | 9.5pt | bold | `#5C6378` | Single use: the small "INVOICE" eyebrow above the invoice number. Uppercase + 0.12em tracking. |

@react-pdf/renderer supports `textTransform`, `letterSpacing`, and `fontWeight` (already used in the current code). It does **not** support `fontFeatureSettings`, so tabular numerals are not enforced; rely on NotoSansSC's default digit metrics, which are close enough at the sizes used.

### 3. Structural changes (top to bottom)

#### Header
- **Left column** stays the same: company name (now bumped to headline 18pt bold, was 20pt — slight reduction for better balance with the new right side), then three body lines (address / email / phone) in `#525873`.
- **Right column** is restructured. Reading top to bottom:
  1. Small eyebrow caption `INVOICE` (9.5pt bold, `#5C6378`, uppercase + 0.12em tracking).
  2. Invoice number as the headline (18pt bold `#0F1729`) — this is now the dominant top-right element.
  3. `Issued <date>` and `Due <date>` lines, each 9pt with the label in `#5C6378` and the date value in `#0F1729` bold.
- The orange "INVOICE" title that previously sat at 18pt orange is gone — the orange accent is reserved for the Total Due.

#### Bill To / Project
- **Drop** the `billingSection` cream-panel + 14px padding + 8px radius treatment entirely.
- Add a single faint hairline rule (`#E8E5DD`, 1pt) above the section to separate it from the header.
- Render as a clean two-column block on white. Left column: caption "Billed to" → headline 18pt name → body lines for address / email. Right column: caption "Project" → headline 18pt project title → body lines for contact / project number.
- 28px gap between columns. Section uses 18px top margin from the divider rule.

#### Line-items table
- **Drop** the `tableHeader` cream-band background.
- Header row: caption 8.5pt bold `#5C6378` uppercase + 0.08em tracking. Bottom border is the new **strong rule** (`#1F2A44`, 1.4pt). No top border.
- Body rows: same grid (description / qty / unit price / total). Description in body-strong (10pt bold `#0F1729`); qty and unit price in body (10pt regular `#525873`); line total in body-strong. Each row separated by a faint hairline (`#E8E5DD`, 1pt) below.
- Same column widths as today (no flex changes).

#### Totals
- **Drop** the boxed/bordered look (the `totalsBox` with internal dividers and a separate "final row" container).
- Right-aligned open list, ~280pt wide.
- Each breakdown row (Subtotal, Discount, Tax, Exchange Rate): label in body 10pt `#5C6378`, value in body-strong 10pt `#0F1729` (Discount value keeps `#A85614`). 5pt vertical padding per row.
- **Final row** ("Total Due"): a strong rule above (`#1F2A44`, 1.4pt), 10pt padding-top, 6pt margin-top. Label is subhead (12pt bold `#0F1729` uppercase + 0.06em tracking, reading "TOTAL DUE"). Value is **display 30pt bold `#D9522B`** — the focal point.

#### Notes
- Caption "Notes" label, then body 10pt `#525873`, line-height 1.4.
- 18pt top margin from the totals block.

#### Wire transfer details (currently "Wiring Instructions")

This block is renamed from "Wiring Instructions" to "Wire transfer details" and substantially restructured. The user iterated on this section heavily in the visual companion (versions v1–v10); the locked-in design follows v10.

**Position: anchored to the bottom of the page.** The wire panel must sit just above the page footer, regardless of how much content is above it. Implementation: make the `<Page>`'s root `<View>` a flex column (it already is, by default), and insert a spacer `<View style={{ flexGrow: 1, minHeight: 24 }}>` between the Notes section and the Wire section. With page padding-bottom reduced to 44pt (see "Page-level changes" below), the wire panel lands ~4–6pt above the footer rule.

**No chip surface.** The old bordered cream box (`wiringBox` + `wiringBoxHeader`) is deleted entirely. Replaced with a single **1pt strong rule** (`#1F2A44`, the new hairline-strong color) across the full content width, with 10pt of padding-top below the rule before the block title. No background fill. No side or bottom borders.

**Block title.** "Wire transfer details" — sentence case (no `textTransform`, no `letterSpacing`), 9.5pt bold `#0F1729`, line-height 1.1. 8pt bottom margin separating the title from the data grid.

**Two-column body layout.** The body splits horizontally into two equal columns with 28pt column gap:

- **Left column** holds the five short fields, stacked top-to-bottom: Beneficiary, Bank, Account No., Routing No., SWIFT Code.
- **Right column** holds the two address fields: Bank Address, Beneficiary Address.

**Row format (both columns).** Each row is a two-cell mini-grid: 88pt label column + flexing value column, 8pt column gap.

- **Labels (`.wf-key`).** Sentence case — "Beneficiary", "Bank", "Account No.", "Routing No.", "SWIFT Code", "Bank Address", "Beneficiary Address". 8.5pt bold `#5C6378`, line-height 1.35. **Explicitly `textTransform: "none"` and `letterSpacing: 0`** — these are non-default values and must be set so the keys never render uppercase. (During brainstorming, the visual companion's framework had a global `.label { text-transform: uppercase }` rule that silently overrode my mockup; the lesson is to be explicit in the @react-pdf StyleSheet too.)
- **Values (`.wf-val`).** Sentence case. **8.5pt** — same size as the labels, not larger. Regular weight (`fontWeight: "normal"`), `#0F1729`, line-height 1.35.

**Row spacing.** 3pt vertical gap between consecutive rows in either column. The two address entries in the right column get a slightly larger gap of **8pt** between them (so the wrapped lines of "Bank Address" don't bleed visually into "Beneficiary Address"). This produces a left column of 5 tightly stacked rows and a right column of 2 entries with more breathing room — both columns feel equally airy in proportion to their content.

Result: a flat, footer-style wire panel that reads as one balanced two-column lookup table, separated from the rest of the page by a single dark rule.

**Page-level changes required to support the bottom-anchor.**

- Page `padding-bottom`: 40pt → **44pt** (was 60pt in the original — slimmed so the wire panel can land closer to the page edge).
- Footer `bottom`: 30pt → **18pt** (slight bump up so it doesn't collide with the wire panel).
- Insert the flex spacer described above between the Notes section's `<View>` and the wire-panel `<View>`.

Because the wire panel now lives at the bottom of the page via a flex spacer (not absolute positioning), it naturally flows on the **last** page when an invoice grows to multiple pages — which is the correct behavior for wire instructions on a multi-page invoice.

#### Footer
- Absolute-positioned at 30pt from the bottom, 40pt left/right margins (unchanged).
- 1pt top border in `#E8E5DD` (unchanged).
- Footer text bumped from `#A4A6B5` to `#5C6378` (the only change). Still 8.5pt bold to differentiate from body.

### 4. What does not change

- Page size, page margins, page orientation.
- Section order.
- The data shape passed to `InvoicePDF` (`InvoicePDFData`, `BusinessProfileData`) — no changes to API routes, page route, or call sites.
- The `getCurrencySymbol` helper and `fmt` formatter.
- Font registration (`register-fonts.ts` is untouched).
- The estimate PDF (`estimate-pdf.tsx`) is not modified in this change.

## Risks / open considerations

- **Visible discontinuity for clients.** Past clients have received the current PDF style; the new version is visibly different. Content is identical; only the visual treatment changes. No client-facing identifier (invoice number, vendor, totals, banking details) is altered. Acceptable as long as nobody has automated downstream tooling that parses the PDF by layout — unlikely for a small-vendor invoice, but worth keeping in mind.
- **Estimate PDF drift.** Until the estimate PDF gets the same treatment, the two documents will look inconsistent in the wild. Plan a follow-up.
- **Variable font weight rendering.** The current setup registers `NotoSansSC-Regular.ttf` as both regular and bold; @react-pdf renders the "bold" registration heavier. The redesign continues to rely on this. If a future font swap breaks the heavier weight, the hierarchy degrades to size-only. Worth verifying once in Preview during the test plan.
- **PDF accessibility ≠ visual contrast.** This work improves *visual* legibility. Real PDF accessibility (tagged structure for screen readers, reading order metadata) is a separate ecosystem (`@react-pdf/renderer` doesn't expose it today). Out of scope; flag for future.

## Test plan (manual — no test framework is configured)

1. Generate a PDF for an invoice that exercises everything: multiple line items including one with a long description, a discount row, an exchange-rate row (CNY duplicate), and a notes block. Verify:
   - Header right column: small "INVOICE" eyebrow, dominant invoice number, dates below with bold values.
   - Bill-To section appears on white with no cream panel; client name reads as headline.
   - Table header has no background fill, has a strong dark rule below, and header text is readable (no longer fading).
   - Totals area is open (no surrounding border); "Total Due" lands as a large orange amount with a strong rule above it.
   - Wire transfer block has no surrounding box.
   - Footer is darker than before.
2. Open the PDF in Apple Preview and in Chrome's built-in viewer. No layout overflow, no clipped text. Long descriptions wrap correctly within the description column.
3. Generate a multi-page invoice (paste a long notes block + many line items) and confirm the fixed footer renders on every page and totals/notes don't overlap the footer.
4. Generate a PDF where notes contain Chinese characters and verify they render via NotoSansSC.
5. Spot-check contrast: pick the table-header text and footer text in a screenshot, run them through any AA contrast checker, confirm ≥4.5:1.
6. Confirm the PMT detail page (`/invoices/[id]`) is unchanged — this work only touches `invoice-pdf.tsx`.

## Files affected

- `src/lib/pdf/invoice-pdf.tsx` — only file modified.

No schema migration. No new dependency. No API change. No call-site change.

## Mockup reference

The validated visual reference for this spec is the v10 mockup at `.superpowers/brainstorm/27055-1778791317/content/pdf-approach-a-v10.html` (also v1–v9 for context). These HTML files are gitignored (`.superpowers/` is in `.gitignore`) and exist only as design reference.

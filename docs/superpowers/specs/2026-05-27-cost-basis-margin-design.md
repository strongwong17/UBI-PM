# Cost Basis & Margin Tracking — Design

**Date:** 2026-05-27
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

The tool tracks revenue (estimates → invoices) but has **no concept of internal cost**, so the team can't see project profitability or overall company margin. We need to log cost basis per project, compute margin, treat incentives as passthrough (excluded from revenue and margin), and report financial health both **per project** and **company-wide**.

## Goals

1. Log internal costs for a project as a **customizable cost ledger** (estimate-builder-style editing).
2. Compute **margin = net revenue − cost** at the project level, both **planned** (approved-estimate quantities) and **delivered** (confirmed actuals).
3. Treat **incentives as passthrough** — excluded from net revenue and margin, surfaced separately.
4. A **Financials dashboard** in the left sidebar (dashboard look & feel) showing the **overall company margin**, a **by-company expandable** breakdown, and a **by-individual (BD owner)** breakdown.
5. Track which **individual** owns a project (new BD/owner field, separate from the delivery assignee).

## Non-Goals

- No multi-currency company rollup — company view is **USD only** (v1).
- No new auth role — the BD manager is a normal `MANAGER` user.
- No budgeted-vs-actual cost split — a single actual cost figure per cost line.
- No cost data in client-facing estimate/invoice PDFs.

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Margin basis | Both **planned** (estimate qty) and **delivered** (delivered qty) revenue, so in-progress and completed projects both show margin |
| Cost input | **Typed per line**: `HOURS` (hours × rate) or `FLAT` (hard cost / reimbursement), toggled per line |
| Cost structure | **Customizable ledger** like the estimate builder — add/edit/remove/reorder rows; can add costs not tied to any revenue line |
| Passthrough | A line is passthrough if `serviceModuleType === "INCENTIVES"` **or** an `isPassthrough` override is set |
| Company currency | **USD only** |
| Where costs are logged | A **Financials sidebar hub** (not a project-hub tab); drill into a project to edit its cost ledger |
| Access | **ADMIN + MANAGER** (VIEWER excluded) |
| Individual tracking | **New `businessDevId` field** on Project, separate from `assignedTo` |
| BD role | Just a `MANAGER` user |
| Tests | Add **vitest** scoped to `margin.ts` |

## Architecture

Cost lives in a **separate project-level ledger** (`CostLineItem`), not as fields on revenue line items. Rationale: the user must add costs that don't map 1:1 to estimate lines, and a project-level ledger survives estimate regeneration. Revenue continues to come from the existing approved-estimate billing math (`computeBillingState` / `estimateSubtotal`); margin is a thin layer combining the two.

### Data model (additive migration — no drops)

**New model `CostLineItem`:**
```
model CostLineItem {
  id          String   @id @default(cuid())
  description String
  costType    String   @default("FLAT") // "HOURS" | "FLAT"
  hours       Float?   // when HOURS
  rate        Float?   // cost per hour, when HOURS
  amount      Float?   // when FLAT
  category    String?  // optional ServiceModuleType-style tag
  sortOrder   Int      @default(0)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```
Computed line cost: `costType === "HOURS" ? (hours ?? 0) * (rate ?? 0) : (amount ?? 0)`.

**`EstimateLineItem`** — add `isPassthrough Boolean @default(false)` (revenue passthrough override).

**`Project`** — add `businessDevId String?` + relation `businessDev User? @relation("ProjectBusinessDev", ...)`. **`User`** — add inverse `businessDevProjects Project[] @relation("ProjectBusinessDev")`.

### Margin library — `src/lib/margin.ts`

Pure, testable functions built on `src/lib/estimate-totals.ts` and `src/lib/estimate-billing.ts`:

- `lineCost(c: CostLineItem): number`
- `isPassthroughRevenueLine(li): boolean` — `serviceModuleType === "INCENTIVES" || isPassthrough`
- `netRevenue(project, getQty): number` — sum of approved, non-RMB, primary-currency estimate line totals **excluding passthrough lines**; `getQty` = `plannedQty` or `deliveredQty`
- `passthroughTotal(project, getQty): number` — sum of passthrough line totals
- `projectCostTotal(project): number` — sum of `lineCost` over the cost ledger
- `computeProjectMargin(project)` → `{ plannedRevenue, deliveredRevenue, cost, plannedMargin, deliveredMargin, plannedMarginPct, deliveredMarginPct, passthrough, currency }`

Reuses `mapEstimateToBillingPhases` / `resolveLineTotal` for percentage-derived lines; passthrough filtering happens before summation.

### API routes

- **`GET /api/projects/[id]/costs`** — return the project's cost ledger (ADMIN/MANAGER).
- **`PUT /api/projects/[id]/costs`** — replace-all cost line items (same pattern as estimate save). Validates `costType`, recomputes nothing server-side beyond persistence; logs activity.
- **`PATCH /api/projects/[id]`** — extend to accept `businessDevId`.
- **`PATCH /api/projects/[id]/revenue-passthrough`** — set `isPassthrough` on one estimate line: body `{ estimateLineItemId, isPassthrough }`. Used by the Revenue panel override toggle. (Project-scoped for the ADMIN/MANAGER gate; verifies the line belongs to an estimate on this project.)

All financial reads for pages happen in **server components** querying `prisma` directly (per project convention).

### Pages & components

- **Sidebar nav** — add `Financials` (ADMIN/MANAGER only) after Invoices.
- **`/financials`** (server component; redirect VIEWER):
  - Hero band: **overall company margin** + Revenue / Cost / Passthrough / Portfolio KPIs. **USD-only** (only projects whose approved non-RMB estimate is USD).
  - **By Individual (BD)** panel — rollup grouped by `businessDev`.
  - **By Company** — expandable table: company rows → project rows → link to project detail. Company total row.
  - Client wrapper for group-by (Company / Owner / Flat), owner filter, status filter (URL `?group=&owner=&status=`).
- **`/financials/[projectId]`** (server component; ADMIN/MANAGER):
  - **Revenue** panel — read-only from approved estimate, passthrough lines marked + per-line passthrough override toggle.
  - **Cost builder** — `cost-line-editor.tsx` client component: rows with HRS/FLAT toggle, inline edit, add (`+ Add cost line`), remove, reorder (`sortOrder`); live total. Saves via `PUT …/costs`.
  - **Margin summary** — net revenue (planned/delivered), cost, margin + % (planned/delivered), passthrough.
  - Uses the project's primary currency (via existing `computeBillingState` primary-currency logic).
- **Project edit/overview form** — add a **BD/owner** user selector writing `businessDevId`.

### Currency & edge cases

- Company `/financials`: include only projects with an approved, non-RMB, **USD** estimate. Per-project detail shows the project's own primary currency.
- Projects with no approved estimate (status `ESTIMATING`): excluded from company rollup (no revenue basis), but costs can still be logged on the detail page.
- Multiple approved estimates (e.g., USD + CNY): project detail revenue uses the primary-currency approved estimates (mirrors `computeBillingState`).
- Cost ledger is project-scoped and independent of estimate versions → unaffected by estimate reopen/regenerate.
- Cost/margin fields are new and unreferenced by `estimate-pdf.tsx` / `invoice-pdf.tsx` → never leak to client PDFs (verify during implementation).

### Access control

ADMIN + MANAGER for all financial views, the cost API, and the sidebar item. VIEWER: hidden nav + route redirect. Follows the existing `requireAuth(["ADMIN","MANAGER"])` pattern.

## Testing

Introduce **vitest** scoped to financial math. Cover `src/lib/margin.ts`:
- `lineCost` for HOURS and FLAT (including null fields).
- Passthrough exclusion: INCENTIVES tag and `isPassthrough` override both removed from net revenue and margin, counted in passthrough total.
- Planned vs delivered net revenue using `plannedQty` / `deliveredQty`.
- `computeProjectMargin` aggregate incl. margin % and zero-revenue guard (no divide-by-zero).
- Company rollup helper (USD filter, exclude no-approved-estimate projects).

No other test scaffolding added; rest verified manually.

## Implementation phases

1. **Foundation** — Prisma migration (`CostLineItem`, `EstimateLineItem.isPassthrough`, `Project.businessDevId` + User inverse), `prisma generate`, `margin.ts` + vitest, `GET/PUT /api/projects/[id]/costs`.
2. **Project financials** — `/financials/[projectId]` page, `cost-line-editor.tsx`, Revenue panel + passthrough override, margin summary, BD/owner selector on the project form, `businessDevId` in project PATCH.
3. **Company dashboard** — `/financials` page (hero, by-company expandable, by-individual, filters), sidebar nav item, VIEWER guard.

## Open risks

- Percentage-basis estimate lines + passthrough interaction: ensure passthrough filtering composes with `resolveLineTotal` (a passthrough line that is itself a percentage basis for another line is an unlikely but worth-checking case).
- "By individual" assumes `businessDevId` is populated; unassigned projects roll up under an "Unassigned" group.

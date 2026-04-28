# Visual Redesign with Phase Hubs — Design Spec

**Date:** 2026-04-28
**Author:** Yushi (with Claude)
**Status:** Approved for implementation planning
**Reference mockups:** `.superpowers/brainstorm/53352-1777404878/content/`

---

## 1. Background

The 2026-04-27 lifecycle redesign decoupled billing from project status, introduced the 7-stage work-only enum (`NEW → BRIEFED → ESTIMATING → APPROVED → IN_PROGRESS → DELIVERED → CLOSED`), and added flexible multi-mode invoicing. That work landed as 22 tasks on `redesign/project-lifecycle` and is logically complete.

Visually, however, the app still wears generic shadcn defaults — slate cards, blue/emerald accents, dense flat tables. The owner described it as "comfortable like Notion" — which it is not — and asked for a complete re-skin that:

- Feels warm and intentional (cream canvas, not cold gray)
- Uses brighter, more saturated accents (not muted pastels)
- Treats indicative information as canvas text and interactive things as raised cards/buttons
- Color-codes lifecycle phases everywhere — pills, hints, labels, eyebrows
- Reorganizes the dashboard into **phase-specific hubs** so users focus on one phase of work at a time
- Honestly grays-out features that aren't built yet, with a click → toast pattern

This spec captures the new visual language and the phase-hub information architecture. It does **not** change product logic — the existing API surface, schema, and state machines stay as built in 2026-04-27.

## 2. Goals

1. Adopt a coherent visual design system: warm cream canvas, near-black ink, terracotta accent, saturated phase-status palette, Inter typography, JetBrains Mono for technical/cockpit text.
2. Restructure the dashboard around 4 **phase hubs** (Inquiry, In Progress, Completion, Archive). One hub is active at a time; counts and stats are always scoped to the active hub.
3. Apply a **cockpit header pattern** at the top of every hub: phase tag → title → 5–6 numerical readouts → status row.
4. Color-code the seven project statuses across every surface that mentions them (pills, rails, eyebrows, stepper, dashboard tiles).
5. Make the per-project page **stage-aware**: which tab is primary depends on the project's current stage.
6. Design the two most-important Hub 3 workflows in full: **Confirm Actuals** (line-by-line variance reconciliation) and **Send Invoice** (preview + send-method selection).
7. Use a consistent gray-with-toast pattern for "under development" features — tools areas, deliverable management, team-load widgets — so users see future capability without misleading them about what works today.

## 3. Non-goals

- No changes to the existing API routes, request/response shapes, or business logic.
- No Prisma schema changes for the visual redesign itself. (Future feature work — deliverables, vendors, team assignments — will need new tables; flagged but **not** part of this spec's implementation.)
- No changes to authentication, roles, permissions, or the activity log subsystem.
- No PDF rendering changes for estimates or invoices.
- No changes to the RMB-duplicate flow.
- Mobile/responsive design is out of scope; desktop-only target.

## 4. Design system foundations

### 4.1 Color tokens

```css
--canvas:        #F8F5EE   /* warm cream, page background */
--canvas-cool:   #F0EDE5   /* slightly cooler, used as inset */
--card:          #FFFFFF
--ink-900:       #0F1729   /* primary text, primary button */
--ink-700:       #2A3548   /* body text */
--ink-500:       #5A6478   /* secondary text */
--ink-400:       #7A8395
--ink-300:       #A0A8B8
--hairline:      #ECE7DD   /* default border */
--hairline-strong: #D9D2C2

--accent:        #D9522B   /* terracotta, used sparingly */
--accent-strong: #BC4220
--accent-soft:   #FBE8DE

--warn:          #C97520   /* amber, stale / warning */
--warn-bg:       #FCEDD9
--warn-fg:       #92511A

/* Status palette — saturated for visibility, soft bg for readability */
--s-new:         #94A3B8   bg #EFF1F5  fg #475569
--s-briefed:     #64748B   bg #E5E9F0  fg #334155
--s-estimating:  #3B82F6   bg #DBEAFE  fg #1D4ED8
--s-approved:    #10B981   bg #D1FAE5  fg #047857
--s-in-progress: #6366F1   bg #E0E7FF  fg #4338CA
--s-delivered:   #059669   bg #C8F0DC  fg #065F46
--s-closed:      #71717A   bg #E7E5DF  fg #3F3F46

/* Execution phase palette (Hub 2 only) */
--p-recruit:  #A855F7
--p-field:    #06B6D4
--p-analyze:  #F59E0B
--p-report:   #EC4899
```

### 4.2 Typography

- **Inter** (400/500/600/700/800) — primary UI font
- **JetBrains Mono** (400/500/600/700) — used for technical labels: cockpit eyebrow tags (`STAGE_01 · INQUIRY`), readout labels (`TOTAL`, `STALE`), status row (`STATUS: NOMINAL`), code-like project IDs (`PRJ-2026-001`), timestamps, and structural eyebrows (`// AWAITING CLIENT RESPONSE`)
- Display headings (greeting, page titles): Inter 700, letter-spacing −0.025em, no serif
- Page logo: lowercase wordmark `ubinsights·` with terracotta dot, Inter 800, tracking −0.04em

### 4.3 Shape language

- **Card radius:** 14px (panels), 12px (smaller widgets), 9px (buttons)
- **Hairline borders** (1px, `--hairline`) — never harsh
- **Hover elevation** on interactive cards: `transform: translateY(-1px or -2px)` + soft warm shadow `0 6px 24px -6px rgba(15,23,41,0.10)`
- **Status indicator dots:** small circles with a 2px halo box-shadow matching the bg tint; the warning/stale dot pulses with a 2.4s blink animation
- **Status pills:** rounded-full, soft bg + dot + saturated fg; small (10–11px font)

### 4.4 Indicative info vs interactive elements

A guiding principle adopted from the brainstorming session:

- **Indicative information** (phase title, status counts, summary numbers, eyebrows) lives on the canvas as **text** — no card, no border, integrated with the background
- **Interactive elements** (project rows, tools, action buttons, tab toggles) are **cards/buttons** with proper affordances — borders, hover states, click feedback

This keeps the page legible at a glance and makes affordances unambiguous.

## 5. Information architecture: Phase Hubs

The dashboard reorganizes from a single mixed-everything view into **4 phase hubs**. One hub is active at a time, selected via a compact pill toggle at the top of the dashboard.

### 5.1 Hub toggle

A horizontal pill bar with 4 hub tabs: `Inquiry · In Progress · Completion · Archive`. Each tab shows the hub's project count. The active tab uses the dark ink-900 background with white text and a glowing status dot in the hub's accent color.

### 5.2 Cockpit header pattern

Every hub uses the same three-part header:

1. **Top row:** mono phase tag (`STAGE_01 · INQUIRY`) + plain-Inter phase title + a context line with a key total and a quiet link to drafts/related items
2. **Readout grid:** 5–6 numerical readouts in a flat row separated by 1px column dividers. Each readout has a status-light dot, a mono uppercase label, a large number (Inter 800, 32px, tabular-nums), and a small mono unit line
3. **Status row:** mono key-value pairs separated by spaces — `STATUS: NOMINAL · UPDATED: 12:42:08 · OLDEST.STALE: 89d` — with a primary action link aligned to the right

The header sits on a single 1px ink-900 top border + 1px hairline bottom border (no surrounding card). It feels like a part of the page, not a widget.

### 5.3 Sub-status groups in body

Below the cockpit, projects are grouped by sub-status appropriate to the active hub. Each group has a mono color-coded eyebrow (`// AWAITING CLIENT RESPONSE · 3`) and a card containing project rows. Empty groups show a mono placeholder card (`// STDBY · NO PROJECTS APPROVED YET`).

Project rows are clickable cards with a colored left rail (4px wide, full row height), project number in mono, title in Inter 500, client in subdued color, and a trailing meta cell with primary metric + secondary timestamp.

### 5.4 Right rail

Each hub has a right rail with:
- **Hub stats live** — calculable metrics derivable from current data
- A hub-specific contextual card (e.g., stale warning in Hub 1, team load preview in Hub 2, variance leaderboard in Hub 3, top clients in Hub 4)
- **Activity log** — recent actions in this hub, mono timestamps

### 5.5 Tools area

Every hub ends with a "tools" area containing 6 cards in a 3×2 grid representing future stage-specific features. All tools are gray (filter: grayscale 0.7), have dashed borders, and on click display a toast: `[Tool name] is under development. // Coming in a future release`.

## 6. Per-hub design

### 6.1 Hub 1 · Inquiry (color: `--s-estimating` / blue)

**Cockpit readouts:** `ACTIVE · BRIEFED · SENT · APPROVED · STALE` (5 cells). The stale dot blinks amber.

**Status row:** `STATUS · UPDATED · OLDEST.STALE · PIPELINE`

**Sub-status groups (3 only):**
1. `// PROJECT BRIEFED · TO ESTIMATE` — slate left rail
2. `// ESTIMATION SENT · AWAITING CLIENT` — blue left rail
3. `// APPROVED · READY FOR NEXT HUB` — green left rail (often empty)

NEW projects (drafts) are not their own group; a quiet link in the cockpit context line surfaces them: `// 2 drafts pending brief →`.

**Right rail:** stale warning banner (with bulk-archive CTA) · live hub stats (pipeline value, awaiting value, avg estimate size, oldest awaiting, stale total · 89d max) · recent activity in hub.

**Tools (gray):** Estimate templates · Send tracker · Auto follow-up · Proposal comments · Conversion analytics · Brief templates.

### 6.2 Hub 2 · In Progress (color: `--s-in-progress` / indigo)

**Cockpit readouts:** `ACTIVE · RECRUITMENT · FIELDWORK · ANALYSIS · REPORTING` — distribution by execution phase.

**Status row:** `STATUS · UPDATED · ACTIVE.VALUE · OLDEST.START · NEWEST.START`

**Sub-status groups (4):** Recruitment / Fieldwork / Analysis / Reporting — each with its own execution-phase color (purple / cyan / amber / pink). Each row shows a mini phase progress (4 dots, current dot in phase color) with a trailing phase label.

**Right rail:** live hub stats (active value, avg project size, largest in-flight) · team-load preview (gray, future) · recent activity.

**Tools (gray):** Team management · Vendor directory · Deliverable tracker · Time logging · Vendor invoice review · Phase deadlines.

### 6.3 Hub 3 · Completion (color: `--s-delivered` / emerald)

**Cockpit readouts:** `ACTIVE · RECONCILE · AWAITING PAY · PAID·ARCHIVE · VARIANCE -2.4%`

**Status row:** `STATUS · UPDATED · TO.INVOICE · RECEIVABLE · DELIVERED.VALUE · AVG.VARIANCE`

**Sub-status groups (3):**
1. `// RECONCILE ACTUALS & SIGN-OFF` — amber rail; rows have variance chip + invoice state pill + primary action button (`Confirm actuals` or `Send invoice`)
2. `// INVOICE SENT · AWAITING PAYMENT` — pink rail; rows show variance + `Sent · due Nd` + `Remind` / `Mark paid` actions
3. `// PAID · READY FOR HUB 4` — emerald rail; transitional, with `Archive →` action

**Variance chips:** under-budget green, over-budget red, on-plan gray.

**Right rail:** live hub stats · variance leaderboard (per-project $ + %) · recent activity.

**Tools (gray):** Auto-reconciliation · Variance reports · Payment reminders · Bank-feed reconciliation · Invoice templates · Currency conversion.

### 6.4 Hub 4 · Archive (color: `--s-closed` / zinc)

**Cockpit readouts:** `TOTAL · LAST.30D · LAST.90D · REVENUE · AVG.PROJECT` — knowledge-library framing.

**Status row:** `STATUS: ARCHIVE · UPDATED · TOP.CLIENT · UNIQUE.CLIENTS · MOST.RECENT · TOP.MODULE`

**Search & filter strip** (distinctive to Hub 4):
- Full-width search input (search projects, clients, service modules, year)
- Filter chips: `Year ▾` · `Client ▾` · `Service ▾` · `Recent first`

**Body:** archived projects grouped by year (`2026 · 11 archived · $148.2K`), each row shows project + client + archive date + a row of small service-module dots (recruit / moderate / translate / pm / etc.) + project value with variance below.

A **feedback chip** per row: `★ 4.5 · feedback collected` or `// no feedback yet` (dashed, gray) — feedback is a future feature.

**Knowledge insight cards** (gray, future): Project knowledge tagging · Case studies · Methodology library · Annual review.

**Right rail:** live hub stats · top clients all-time leaderboard · service mix all-time (horizontal stacked bar + legend with %).

**Tools (gray):** Feedback request · Internal learnings · Knowledge search · Reusable insights · Client retention dashboard · Capability heatmap.

## 7. Project detail page (stage-aware)

Clicking a project row opens its detail page. The page header is the same across stages but the **primary tab** and recommended action change based on `project.status`.

### 7.1 Common header

- Crumbs: `Projects › <Client> › <ProjectNumber>`
- Project meta: project number (mono) + status pill
- Title (Inter 700, 24px) + sub-line (client · timeline · lead · approved value)
- Stage stepper: 4 cards across (Inquiry / In Progress / Completion / Archive). Done stages have a colored top bar and "what happened" sub-text. Active stage has the hub-color border + soft colored shadow.
- Tab strip: `Overview · Brief · Estimate · Execution · Confirm Actuals · Invoice` — the active tab depends on stage and user navigation.

### 7.2 Stage 1 view (Inquiry phase)

The default tab is **Estimate**. Layout:

- **Left (hero):** Estimate document — full proposal-style preview with header (estimate number, issue date, valid-until, currency, pricing), grouped phases of line items, totals, and a footer ("Last edited Nh ago by Yushi · v3 of 3 · Download PDF →"). Looks like what the client sees.
- **Right rail:**
  - Sticky-ish "Ready to share?" action card with a single big terracotta `Send estimate to client` CTA
  - Client card (avatar, name, role, key client stats, "View profile →")
  - Versions list (v1 / v2 / v3 with diff metadata)
  - Notes & activity feed

### 7.3 Stage 2 view (In Progress)

The default tab is **Execution**. Layout:

- **Phase progress strip** at top: 4 cells (Recruit / Field / Analyze / Report), each with progress bar + mini count (`3/3 done`). Trailing button: `▶ Advance phase` (only enabled when current phase is 100%).
- **Deliverables panel** (most of the page):
  - Header: title + summary (`4 of 9 done · 3 in flight · 2 not started`) + filter chips (`All · Mine · In flight · Blocked`)
  - Grouped by execution phase, each phase has its colored eyebrow + count
  - Each deliverable row: status pill (To do / In Progress / In Review / Done / Blocked) + name + source (`// from EST-line · Recruitment · 30 × $60`) + owner avatar (with vendor dot if external) + due date (overdue / soon coloring) + actions
  - Footer: `+ Add deliverable` button + meta (`// 7 from estimate · 2 added manually`)
- **Empty state** (when project just entered Stage 2): big card with `Generate from estimate · 7 lines` CTA + secondary "build manually" link, plus a "what happens next" lifecycle reminder card on the right
- **Right rail:**
  - Lifecycle reminder card (numbered steps showing current position)
  - Team panel (members + vendors + per-person deliverable counts) with `+ Assign team / vendor` CTA
  - Activity feed for this project

**Note:** The deliverable system requires new data models (see §10). This is built **after** the visual redesign lands. The Stage 2 page in the current visual-only redesign should display the existing Execution data and use the gray placeholder pattern for the deliverable management section.

### 7.4 Stage 3 view (Completion)

Two distinct sub-pages, both tabs in the project detail:

#### 7.4.1 Confirm Actuals

The line-by-line reconciliation form. Replaces the existing Delivery & Sign-off tab.

- **Action header:** "Confirm actuals" + subtitle. Bulk shortcut buttons: `↓ Pull from deliverables` (when deliverables exist) and `✓ Mark all as planned` (one-click for on-plan projects)
- **Phase blocks:** one per estimate phase, with the phase's color in the header. Inside each:
  - Column header: `Line item · Planned · Delivered · Variance`
  - Per-line row with **inline editable Delivered input** (numeric, with × unitPrice = total auto-shown after the input). When confirmed, the input's border + bg turn emerald and a `Confirmed` badge appears next to the line description.
  - Each row has a variance chip: `-$120 / -6.7%` (under-budget green), `on plan` (gray), `+$X / +Y%` (over-budget red), or `// pending` (dashed gray)
  - Phase footer: phase totals per column
- **Totals card** (heavy ink-900 border): three columns — Planned · Delivered · Variance. Variance number colored by sign.
- **Notes & sign-off card:** notes textarea + internal sign-off checkbox (auto-stamps user + timestamp) + client acknowledgement checkbox + name input.
- **Sticky-ish action footer:** running summary (`3 of 7 lines confirmed · -$120 variance · $5,920 still pending`) + buttons: `Save draft` · `Save & continue later` · **`✓ Confirm & generate draft invoice`** (primary, emerald)

The "Confirm & generate draft invoice" CTA is the single bridge from this page to Send Invoice (§7.4.2). It uses the existing `POST /api/projects/[id]/invoices` endpoint with `mode: SLICE` and the confirmed delivered quantities as line items. Result: a new Invoice in DRAFT status, then user lands on the Send Invoice page.

This is calculable today: `EstimateLineItem.deliveredQuantity` was added in the 2026-04-27 redesign, so the reconciliation already has a target column.

#### 7.4.2 Send Invoice

The dedicated page that opens after generating a draft invoice (or when the user clicks "Send invoice" on a DRAFT). Two-column layout:

- **Top:** stage stepper with Stage 3 active. A small green banner: `⚡ Draft invoice generated from confirmed actuals just now · 7 line items pulled · variance applied · INV-2026-XXXX · DRAFT · 12:42:08`.
- **Left column (invoice document preview):** The invoice as the client will see it, in PDF-document style. Includes:
  - Header: ubinsights logo + company billing details on left; big `INVOICE` title + invoice number on right
  - 4-column meta strip: Bill to · Issue date · Due date (with NET terms) · Project ref
  - Line item table (mono headers, dashed-row borders): description with phase color tag, qty, rate, amount
  - Totals: subtotal, tax, **Total due** (heavy black top border)
  - Notes / payment instructions section (mono bank info, friendly closing)
  - Toolbar above doc: `INV-XXXX · DRAFT preview` + `Client view / Edit` toggle (Edit is gray future for now)
- **Right column (sticky send panel):**
  - Header: `Ready to send` with green status dot + brief explanation of post-send state machine
  - Recipient card (avatar + name + email + Change link)
  - Subject input (pre-filled, editable)
  - Message textarea (pre-filled friendly note from the project lead, editable; "Use template" link is future)
  - Send method buttons (3 stacked):
    - `Send via email` — gray with `soon` tag (needs new email integration)
    - `Download PDF & mark as sent` — works today using the existing PDF route
    - `Copy share link` — gray with `soon` tag (needs public-view page)
  - Subtle escape hatch: `or just mark as sent without delivering →`
- **Below:** "After you send" card explaining: DRAFT → SENT, project moves to Awaiting payment, can send reminder, marking PAID enables Archive → Hub 4.

### 7.5 Stage 4 view (Archive)

A read-only retrospective view of the closed project. Out of scope for this redesign's first pass — the dashboard-level Hub 4 covers most use cases. Detail page is a small follow-up.

## 8. Key workflows summary

The two most consequential flows in the redesign:

| Flow | Page | Status today |
|------|------|---|
| **Confirm Actuals** | Project detail · Confirm Actuals tab | Calculable from existing schema (`EstimateLineItem.deliveredQuantity`) |
| **Send Invoice** | Project detail · Invoice tab (Send mode) | Invoice generation works today (`POST /api/projects/[id]/invoices`); PDF download works today; email + share link need new features |

Both flows use the existing 2026-04-27 redesign's plumbing. No new backend work is required to ship them visually.

## 9. Future features (gray-disabled in current scope)

Each future feature uses the gray-with-toast pattern: dashed gray borders, faded icons, on click → dark toast `[Feature] is under development · Coming in a future release`. Listed here for the record so they can be planned later:

### Hub 1 future tools
- Estimate templates
- Send tracker (open/view analytics)
- Auto follow-up emails
- Proposal comments (client-side line-item comments)
- Conversion analytics
- Brief templates

### Hub 2 future tools / data
- Team management (assign internal team members per project)
- Vendor directory (reusable vendor profiles + rate cards)
- Deliverable tracker (per-line deliverables with owners, statuses, due dates)
- Time logging (hours per person per project)
- Vendor invoice review (incoming invoices linked to line items)
- Phase deadlines (alerting)

### Hub 3 future tools
- Auto-reconciliation (pre-fill delivered = planned for done deliverables)
- Variance reports
- Payment reminders (automated email cadence)
- Bank-feed reconciliation
- Invoice templates (per-client branding)
- Currency conversion (RMB rate snapshots)

### Hub 4 future tools
- Client feedback request (survey email after archive)
- Internal learnings notes
- Knowledge search across all archived projects
- Reusable insights tagging
- Client retention dashboard
- Capability heatmap (service mix evolution)
- Project knowledge tagging
- Case study generator
- Methodology library
- Annual review

## 10. Data model implications

**No data model changes are required for the visual redesign itself.** Everything described in §6 and §7.4 (Confirm Actuals + Send Invoice) is calculable from the current schema after the 2026-04-27 redesign.

The future features listed in §9 will require new tables when they're built. Listed here so they're not forgotten:

- `Deliverable` — `projectId`, `estimateLineItemId` (nullable, links to source), `executionPhase`, `name`, `description`, `status` (`NOT_STARTED | IN_PROGRESS | IN_REVIEW | DONE | BLOCKED`), `ownerUserId` or `ownerVendorId` (polymorphic via two nullable FKs), `dueDate`, timestamps
- `Vendor` — `name`, `contactName`, `email`, `rateCard` (jsonb)
- `ProjectAssignment` — links `Project` to a `User` or `Vendor` with a role
- `ClientFeedback` — `projectId`, `rating`, `text`, `submittedAt`, `submittedBy` (nullable for client-submitted via share link)
- Optional `Estimate.sentAt` and `Estimate.approvedAt` columns to enable conversion-window metrics that are currently flagged as "needs history" in Hub 1's right rail

These additions are explicitly **not part of this redesign**. They're separate roadmap items.

## 11. Implementation phases

The visual redesign is large enough that it should be implemented in phases. The implementation plan (separate document) will sequence them; this section gives the high-level shape:

1. **Foundations** — Tailwind tokens, fonts (Inter + JetBrains Mono), shared components (status pill, cockpit readout, hub toggle, gray tool card, toast), color helpers
2. **Layout shell** — sidebar, top bar, logo, page wrapper
3. **Dashboard** — replace `/dashboard` with hub-toggle layout; implement Hub 1 first as the canonical hub, then Hubs 2/3/4
4. **Project detail page · Stage 1** — restyle existing Brief/Estimate tabs around the proposal-document pattern
5. **Project detail page · Stage 2** — restyle Execution tab; deliverable management section is a gray placeholder card
6. **Project detail page · Stage 3 — Confirm Actuals** — replace existing Delivery & Sign-off form with the new line-by-line variance reconciliation page
7. **Project detail page · Stage 3 — Send Invoice** — new dedicated page after generating draft invoice
8. **Project list page** restyle
9. **Estimates / Invoices / Clients list pages** restyle (lower priority; can use existing layouts with new tokens)
10. **Polish** — gray "future" tools across all hubs, toast wiring, hover states, empty states, focus states, keyboard shortcuts (low priority)

Each phase must independently pass type-check and not regress existing functionality. The implementation plan will detail file-level changes per phase.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Visual change is so large it breaks user muscle memory | Keep navigation paths and URLs unchanged; the hub toggle replaces the existing single dashboard but `/dashboard` route stays. Project detail tabs keep the same `?tab=` keys. |
| Cream canvas + warm shadows fail on dark-mode users | No dark mode in scope. If added later, the palette translates: cream → near-black canvas, hairlines → translucent white. |
| JetBrains Mono adds non-trivial font load weight | Use `display=swap` so type renders before mono font is ready. Limit weights loaded to 400/600/700. |
| Color-coded labels with multiple colors on screen feel busy | Solved by the "info on canvas / actions in cards" principle: color codes appear only on indicative info (eyebrows, labels, dots), never on row titles or body text |
| Users expect features that are gray-disabled to work | The toast (`Tool is under development. Coming in a future release.`) is unambiguous, and gray styling signals it pre-click |
| Confirming actuals requires data we don't track yet | We track `deliveredQuantity` per `EstimateLineItem` already (added 2026-04-27). Bulk-action "Mark all as planned" is the fast path for on-plan projects |
| Send Invoice's email/share-link aren't built | Tagged `soon` in the UI, not pretending to work; `Download PDF & mark as sent` is the working path today |

## 13. Out of scope

- Mobile / responsive layout
- Dark mode
- Internationalization (UI is English-only)
- Email sending infrastructure (needed for `Send via email`)
- Public-view page (needed for `Copy share link`)
- New deliverable / vendor / team / feedback data models — listed in §10 but explicitly future
- Project list filter persistence, saved views, custom dashboards
- Real-time collaboration / multi-user presence indicators

## 14. Open questions

None at design time. All scope decisions were made during the brainstorming session in `.superpowers/brainstorm/53352-1777404878/`. Implementation planning will surface task-level questions; those go in the plan document.

## 15. References

- Brainstorming session content: `.superpowers/brainstorm/53352-1777404878/content/`
  - `01-design-system.html` through `06-dashboard-v5.html` — design system and dashboard iterations
  - `07-structure-options.html` — three structural directions explored
  - `09-dashboard-hubs.html`, `10-dashboard-hubs-v2.html` — hub-based dashboard
  - `11-header-directions.html`, `12-header-directions-v2.html` — six header treatments
  - `13-hub1-cockpit.html` through `15-hub1-cockpit-v3.html` — Hub 1 cockpit iterations
  - `16-hub2-in-progress.html` — Hub 2
  - `17-stage2-execution.html` — Stage 2 deliverable management
  - `18-hub3-completion.html` — Hub 3
  - `19-hub4-archive.html` — Hub 4
  - `20-confirm-actuals.html` — Confirm Actuals workflow
  - `21-send-invoice.html` — Send Invoice workflow
- Predecessor spec: `docs/superpowers/specs/2026-04-27-project-lifecycle-redesign-design.md`
- Predecessor implementation: `docs/superpowers/plans/2026-04-27-project-lifecycle-redesign.md`
- Current schema: `prisma/schema.prisma`
- Current style tokens: `src/app/globals.css`, `tailwind.config.ts`
- Current theme reference (to replace): default shadcn slate

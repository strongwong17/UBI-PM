# Dashboard Hubs: Flat List + Expired Status

**Date:** 2026-04-30
**Status:** Approved (pending user review of this spec)

## Problem

Dashboard hubs at `/` already filter projects by `project.status`, but within each hub the projects get *swallowed* by status/phase subgroupings:

- **Inquiry hub** — `NEW` projects render only as a header link, not in any list. `ESTIMATING` projects flagged as "stale" (>30d no movement) get filtered out of the visible "sent" group and show only as a sidebar warning card. The "APPROVED · READY FOR NEXT HUB" subgroup is permanently empty because the `APPROVED` status no longer exists (approval auto-flips to `IN_PROGRESS`).
- **In Progress hub** — splits by `executionPhase`. Any project with `executionPhase = null` lands in **none** of the four phase buckets and disappears from the dashboard entirely.
- **Completion hub** — classifies into reconcile / awaiting-pay / paid via `find` on `invoices`, which only inspects the first matching invoice. Projects with mixed invoice statuses get misclassified.

Net effect: many real projects are not visible on the dashboard.

Separately, projects in `ESTIMATING` whose estimates are >30 days old never convert in practice, but they continue to clutter the Inquiry hub. They should be auto-archived (estimates "survive" 30 days from sent).

## Goals

1. Every project is listed in the correct hub. No status combination swallows a project.
2. Drop the within-hub status/phase subgroupings — replace each hub's body with a single flat list, sorted by `updatedAt desc`.
3. Add an `EXPIRED` project status for projects whose latest sent estimate has aged past 30 days with no approval. Auto-flip happens on dashboard load. Expired projects show in the Archive hub alongside `CLOSED`.

## Non-goals

- Not adding manual tags or filter chips. (The user mentioned tags as a possible future option; out of scope here.)
- Not wiring up Completion hub's "Send invoice" or "Mark paid" buttons — they remain decorative for this scope.
- Not removing the Cockpit metric readouts that count by sub-status (BRIEFED/SENT/APPROVED in Inquiry, RECRUITMENT/FIELDWORK/ANALYSIS/REPORTING in In Progress). Those are informational counters, not list filters; they stay.
- Not changing the Archive hub's year-grouping. Year buckets are not a status-based grouping and remain.
- Not introducing a cron job. The auto-archive sweep runs inline on dashboard page load (already `force-dynamic`).

## Design

### 1. Status enum — add `EXPIRED`

`project.status` is a `String` column in Prisma (not a Prisma enum), so this is a TypeScript + UI change with **no DB migration**.

- `src/types/index.ts` — add `"EXPIRED"` to the `ProjectStatus` union.
- `src/components/shared/status-badge.tsx` — add `EXPIRED: "bg-zinc-100 text-zinc-500 border-zinc-200"` (dim gray, distinct from CLOSED's slightly darker zinc).
- `src/lib/redesign-tokens.ts` (and any related token map) — if a token mapping for project status exists, add `EXPIRED`.

### 2. Hub-to-status mapping (in `src/app/(dashboard)/page.tsx`)

| Hub | Statuses |
|---|---|
| Inquiry | `NEW`, `BRIEFED`, `ESTIMATING` |
| In Progress | `IN_PROGRESS` |
| Completion | `DELIVERED` |
| Archive | `CLOSED`, `EXPIRED` |

Remove `APPROVED` from the Inquiry filter (dead status).

### 3. Auto-archive sweep

Runs at the top of `DashboardPage` before the project fetch.

**Rule:** A project flips from `ESTIMATING` to `EXPIRED` if **all** of:
- `project.status === "ESTIMATING"`
- No estimate on the project has `isApproved = true`
- The project has **at least one** non-deleted estimate with `status = "SENT"`
- **Every** non-deleted `SENT` estimate has `updatedAt < now - 30 days`

The clock is the estimate's `updatedAt` (not the project's). Generating a new estimate version resets the clock for that version; the rule requires *all* sent estimates to be aged out, so a fresh v2 keeps the project alive.

**Implementation:** new helper `src/lib/expire-stale-estimates.ts` exports `expireStaleEstimates()`. Logic:

```ts
const cutoff = new Date(Date.now() - 30 * 86_400_000);
const candidates = await prisma.project.findMany({
  where: {
    status: "ESTIMATING",
    estimates: {
      some: { deletedAt: null, status: "SENT" },
      none: { deletedAt: null, isApproved: true },
    },
  },
  include: { estimates: { where: { deletedAt: null, status: "SENT" } } },
});
const toExpire = candidates
  .filter((p) => p.estimates.length > 0 && p.estimates.every((e) => e.updatedAt < cutoff))
  .map((p) => p.id);
if (toExpire.length > 0) {
  await prisma.project.updateMany({
    where: { id: { in: toExpire } },
    data: { status: "EXPIRED" },
  });
}
```

Called from `DashboardPage` before the existing `prisma.project.findMany`. Errors are logged but do not block rendering (wrap in try/catch).

### 4. Hub list rendering — flat list

Each hub component (`hub-1-inquiry.tsx`, `hub-2-in-progress.tsx`, `hub-3-completion.tsx`) replaces its multiple `SubGroup`/`PhaseGroup`/`CompletionGroup` blocks with **one** flat list component.

Hub 4 (`hub-4-archive.tsx`) keeps its year-grouping; only its row content is updated to show the closed-vs-expired chip.

**Shared row component** (new file `src/components/redesign/hubs/hub-project-row.tsx`):

```tsx
<Link href={`/projects/${p.id}`} className="grid items-center gap-3.5 px-4 py-3 ...">
  <span /* status dot */ />
  <span>
    <span /* projectNumber */ />
    <div /* title */ />
    <div /* client.company */ />
  </span>
  <StatusPill status={p.status} executionPhase={p.executionPhase} />
  <span /* approved estimate value, e.g. $12,500 */ />
  <span /* "last touched 4d ago" from updatedAt */ />
  <span>›</span>
</Link>
```

**Status pill rules:**
- Inquiry hub: shows `NEW` / `BRIEFED` / `ESTIMATING`
- In Progress hub: shows execution phase (`RECRUITMENT` / `FIELDWORK` / `ANALYSIS` / `REPORTING`), or `NO PHASE` if `executionPhase` is null
- Completion hub: shows `DELIVERED` (sub-state of invoices is visible on the project page)
- Archive hub: shows `CLOSED` (green chip) or `EXPIRED` (dim gray chip)

The pill component lives in the same file or an adjacent one and switches on hub key.

**Sort order:** `updatedAt desc` for all hubs (already the page query's order — keep it; no per-hub re-sort needed).

**Empty state:** if a hub has zero projects, show one card: `// STDBY · NO PROJECTS IN <HUB>`.

### 5. Completion hub — wire up Archive button only

In `hub-3-completion.tsx`, the `Archive →` button currently does nothing. Wire it to PATCH `/api/projects/[id]` with `{ status: "CLOSED" }` then refresh the dashboard.

Implementation: convert the button row into a small client component (`src/components/redesign/hubs/archive-button.tsx`):

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CLOSED" }),
        });
        setBusy(false);
        if (res.ok) router.refresh();
        else alert("Failed to archive");
      }}
      className="..."
    >
      {busy ? "Archiving…" : "Archive →"}
    </button>
  );
}
```

`Send invoice` and `Mark paid` buttons stay as decorative `<button type="button">` with no handler — explicitly out of scope.

### 6. Cleanup

- Delete the `SubGroup`, `PhaseGroup`, and `CompletionGroup` helpers from each hub file once the flat list replaces them.
- Delete the `staleProjects` warning card / sidebar logic in `hub-1-inquiry.tsx` — auto-archive replaces it. Stale `ESTIMATING` projects either age out to `EXPIRED` automatically or remain visible in the flat list.
- Drop the inquiry-hub Cockpit `STALE` readout entirely — it was tracking the same condition that now auto-archives, so it's redundant. Replace its slot with the `NEW` count (currently shown only as a header link).
- Remove the dead `APPROVED` filter from `page.tsx`.

## Testing strategy

Manual smoke test (no test framework configured per CLAUDE.md):
1. Seed has 1 sample project — verify it shows in its correct hub.
2. Manually create projects in each status (NEW, BRIEFED, ESTIMATING, IN_PROGRESS, DELIVERED, CLOSED) — verify each appears in exactly one hub.
3. Create a project, generate + send an estimate, manually backdate the estimate's `updatedAt` to 31 days ago via Prisma Studio, refresh the dashboard — verify the project flips to `EXPIRED` and appears in Archive.
4. Same as (3) but with two estimates, only one aged out — verify project stays in Inquiry.
5. Click "Archive →" on a project in the Completion hub — verify status flips to `CLOSED` and project moves to Archive.

## Files touched

**New:**
- `src/lib/expire-stale-estimates.ts`
- `src/components/redesign/hubs/hub-project-row.tsx`
- `src/components/redesign/hubs/archive-button.tsx`

**Modified:**
- `src/types/index.ts` (add `EXPIRED`)
- `src/components/shared/status-badge.tsx` (add `EXPIRED` color)
- `src/app/(dashboard)/page.tsx` (call sweep, drop `APPROVED`, include `EXPIRED` in archive filter)
- `src/components/redesign/hubs/hub-1-inquiry.tsx` (flat list, drop subgroups + stale card)
- `src/components/redesign/hubs/hub-2-in-progress.tsx` (flat list, drop phase groups)
- `src/components/redesign/hubs/hub-3-completion.tsx` (flat list, drop classification subgroups, wire Archive button)
- `src/components/redesign/hubs/hub-4-archive.tsx` (include `EXPIRED` projects, add closed/expired chip)
- `CLAUDE.md` (add `EXPIRED` to the project-statuses list and document the auto-archive rule)

## Open implementation choices (cosmetic only — resolve during the plan)

- Exact color tokens for the `EXPIRED` chip and dot — match against existing zinc/stone palette.
- Final styling of the dashboard row layout (column widths, spacing) — preserve the current `4px 1fr ... 24px` grid pattern unless it conflicts with the new pill column.

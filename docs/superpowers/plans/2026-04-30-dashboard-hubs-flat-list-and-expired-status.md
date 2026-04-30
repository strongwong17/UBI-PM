# Dashboard Hubs: Flat List + Expired Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every project visible in its correct dashboard hub by replacing within-hub status/phase subgroupings with one flat list per hub, and auto-archive `ESTIMATING` projects whose sent estimates are >30 days old by introducing an `EXPIRED` status.

**Architecture:** `project.status` is already a `String` column (not a Prisma enum), so `EXPIRED` is added by string literal — no DB migration. The dashboard page (`force-dynamic`) runs an inline sweep that flips eligible `ESTIMATING` projects to `EXPIRED` before fetching, then filters projects into hub buckets purely by `status`. Each hub renders one flat list via a shared `HubProjectRow` component.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 + PostgreSQL, NextAuth v5, Tailwind v4, shadcn/ui.

**Note on testing:** This codebase has **no test framework configured** (per `CLAUDE.md`). Verification per task is `npm run build` (which also type-checks) and `npm run lint`. End-to-end manual smoke testing happens in the final task.

---

## File Structure

**New files:**
- `src/lib/expire-stale-estimates.ts` — auto-archive sweep helper
- `src/components/redesign/hubs/hub-project-row.tsx` — shared flat-list row + status pill
- `src/components/redesign/hubs/archive-button.tsx` — client component that PATCHes status=CLOSED

**Modified files:**
- `src/types/index.ts` — add `EXPIRED` to `ProjectStatus`
- `src/components/shared/status-badge.tsx` — add `EXPIRED` color
- `src/app/(dashboard)/page.tsx` — call sweep, drop `APPROVED`, include `EXPIRED` in archive
- `src/components/redesign/hubs/hub-1-inquiry.tsx` — flat list, drop `SubGroup` + stale card
- `src/components/redesign/hubs/hub-2-in-progress.tsx` — flat list, drop `PhaseGroup`
- `src/components/redesign/hubs/hub-3-completion.tsx` — flat list, drop `CompletionGroup`, wire Archive button
- `src/components/redesign/hubs/hub-4-archive.tsx` — show `EXPIRED` + chip (year grouping kept)
- `CLAUDE.md` — document `EXPIRED` and the auto-archive rule

---

## Task 1: Add `EXPIRED` to `ProjectStatus` type and StatusBadge

**Files:**
- Modify: `src/types/index.ts:14-21`
- Modify: `src/components/shared/status-badge.tsx:4-24`

- [ ] **Step 1: Add `EXPIRED` to the `ProjectStatus` union**

Edit `src/types/index.ts`. Replace the `ProjectStatus` union with:

```ts
export type ProjectStatus =
  | "NEW"
  | "BRIEFED"
  | "ESTIMATING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CLOSED"
  | "EXPIRED";
```

(Keep `APPROVED` in the type for now — other places in the codebase may still reference it. Removing it from the dashboard filter is enough for this scope.)

- [ ] **Step 2: Add `EXPIRED` color to StatusBadge**

Edit `src/components/shared/status-badge.tsx`. In `statusColorMap`, after the `CLOSED` line:

```ts
CLOSED: "bg-zinc-200 text-zinc-700 border-zinc-300",
EXPIRED: "bg-zinc-100 text-zinc-500 border-zinc-200",
```

- [ ] **Step 3: Build to verify types compile**

Run: `npm run build`
Expected: build completes without TypeScript errors. (May fail later if other files have switch/case statements that exhaustively match `ProjectStatus`. If so, add a default branch in those files. From a quick scan, no exhaustive matches exist on `ProjectStatus`, so build should pass.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/shared/status-badge.tsx
git commit -m "feat: add EXPIRED project status"
```

---

## Task 2: Create the auto-archive sweep helper

**Files:**
- Create: `src/lib/expire-stale-estimates.ts`

- [ ] **Step 1: Write the helper**

Create `src/lib/expire-stale-estimates.ts` with this exact content:

```ts
import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * Flip ESTIMATING projects to EXPIRED when every non-deleted SENT estimate
 * is older than 30 days and no estimate is approved. Idempotent.
 */
export async function expireStaleEstimates(): Promise<number> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const candidates = await prisma.project.findMany({
    where: {
      status: "ESTIMATING",
      estimates: {
        some: { deletedAt: null, status: "SENT" },
        none: { deletedAt: null, isApproved: true },
      },
    },
    select: {
      id: true,
      estimates: {
        where: { deletedAt: null, status: "SENT" },
        select: { updatedAt: true },
      },
    },
  });

  const toExpire = candidates
    .filter(
      (p) =>
        p.estimates.length > 0 &&
        p.estimates.every((e) => e.updatedAt < cutoff),
    )
    .map((p) => p.id);

  if (toExpire.length === 0) return 0;

  await prisma.project.updateMany({
    where: { id: { in: toExpire } },
    data: { status: "EXPIRED" },
  });
  return toExpire.length;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/expire-stale-estimates.ts
git commit -m "feat: add expireStaleEstimates sweep helper"
```

---

## Task 3: Create shared `HubProjectRow` component

**Files:**
- Create: `src/components/redesign/hubs/hub-project-row.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/redesign/hubs/hub-project-row.tsx` with this exact content:

```tsx
import Link from "next/link";
import { currencySymbol } from "@/lib/currency";

export interface HubProjectRowData {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  executionPhase: string | null;
  updatedAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

export type HubKind = "inquiry" | "in-progress" | "completion" | "archive";

function pillForHub(kind: HubKind, p: HubProjectRowData): { label: string; bg: string; fg: string; dot: string } {
  if (kind === "inquiry") {
    const map: Record<string, { bg: string; fg: string; dot: string }> = {
      NEW:        { bg: "var(--color-canvas-cool)", fg: "var(--color-ink-500)", dot: "var(--color-ink-300)" },
      BRIEFED:    { bg: "var(--color-s-briefed-bg)", fg: "var(--color-s-briefed-fg)", dot: "var(--color-s-briefed)" },
      ESTIMATING: { bg: "var(--color-s-estimating-bg)", fg: "var(--color-s-estimating-fg)", dot: "var(--color-s-estimating)" },
    };
    const t = map[p.status] ?? map.NEW;
    return { label: p.status, ...t };
  }
  if (kind === "in-progress") {
    const phase = p.executionPhase ?? "NO_PHASE";
    const map: Record<string, { bg: string; fg: string; dot: string }> = {
      RECRUITMENT: { bg: "rgba(101, 163, 13, 0.10)", fg: "var(--color-p-recruit-fg)", dot: "var(--color-p-recruit)" },
      FIELDWORK:   { bg: "rgba(245, 158, 11, 0.10)", fg: "var(--color-p-field-fg)", dot: "var(--color-p-field)" },
      ANALYSIS:    { bg: "rgba(99, 102, 241, 0.10)", fg: "var(--color-p-analyze-fg)", dot: "var(--color-p-analyze)" },
      REPORTING:   { bg: "rgba(236, 72, 153, 0.10)", fg: "var(--color-p-report-fg)", dot: "var(--color-p-report)" },
      NO_PHASE:    { bg: "var(--color-canvas-cool)", fg: "var(--color-ink-500)", dot: "var(--color-ink-300)" },
    };
    const t = map[phase] ?? map.NO_PHASE;
    const label = phase === "NO_PHASE" ? "NO PHASE" : phase;
    return { label, ...t };
  }
  if (kind === "completion") {
    return {
      label: "DELIVERED",
      bg: "var(--color-s-delivered-bg)",
      fg: "var(--color-s-delivered-fg)",
      dot: "var(--color-s-delivered)",
    };
  }
  // archive
  if (p.status === "EXPIRED") {
    return { label: "EXPIRED", bg: "#F4F4F5", fg: "#71717A", dot: "#A1A1AA" };
  }
  return {
    label: "CLOSED",
    bg: "var(--color-s-closed-bg)",
    fg: "var(--color-s-closed-fg)",
    dot: "var(--color-s-closed)",
  };
}

function approvedValue(p: HubProjectRowData): string {
  const e = p.estimates.find((x) => x.isApproved);
  if (!e) return "—";
  return `${currencySymbol(e.currency)}${e.total.toLocaleString()}`;
}

function daysAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function HubProjectRow({
  project,
  kind,
  trailing,
}: {
  project: HubProjectRowData;
  kind: HubKind;
  trailing?: React.ReactNode;
}) {
  const pill = pillForHub(kind, project);
  const value = approvedValue(project);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="grid items-center gap-3.5 px-4 py-3 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
      style={{ gridTemplateColumns: "4px 1fr auto auto auto 24px" }}
    >
      <span className="w-1 h-9 rounded-full" style={{ background: pill.dot }} />
      <span>
        <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{project.projectNumber}</span>
        <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{project.title}</div>
        <div className="text-[11px] text-ink-500">{project.client.company}</div>
      </span>
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
        style={{ background: pill.bg, color: pill.fg }}
      >
        <span className="w-1 h-1 rounded-full" style={{ background: pill.dot }} />
        {pill.label}
      </span>
      <span className="text-right">
        <div className="text-xs text-ink-700 font-medium rd-tabular">{value}</div>
        <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">touched {daysAgo(project.updatedAt)}</div>
      </span>
      <span className="text-right">{trailing}</span>
      <span className="text-ink-300 text-sm text-right">›</span>
    </Link>
  );
}

export function HubEmptyState({ hubLabel }: { hubLabel: string }) {
  return (
    <div
      className="rounded-xl p-6 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
      style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
    >
      {`// STDBY · NO PROJECTS IN ${hubLabel.toUpperCase()}`}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build passes. If any of the CSS variables (e.g. `--color-p-recruit-fg`) don't exist, the build still passes (CSS vars are runtime), but the badges will display fallback colors. The variables come from `src/lib/redesign-tokens.ts` and `globals.css` — they are pre-existing in this codebase from the hub redesign work.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-project-row.tsx
git commit -m "feat: add shared HubProjectRow component"
```

---

## Task 4: Create `ArchiveButton` client component

**Files:**
- Create: `src/components/redesign/hubs/archive-button.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/redesign/hubs/archive-button.tsx` with this exact content:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        setError("Failed to archive");
        setBusy(false);
        return;
      }
      router.refresh();
      // leave busy=true so the button stays disabled until the refresh re-renders the row out
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={archive}
      className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white disabled:opacity-50"
      style={{ background: "var(--color-ink-900)" }}
      title={error ?? undefined}
    >
      {busy ? "Archiving…" : "Archive →"}
    </button>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/archive-button.tsx
git commit -m "feat: add ArchiveButton client component"
```

---

## Task 5: Wire sweep into dashboard page + fix status filters

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Import the sweep helper and call it before fetching**

Edit `src/app/(dashboard)/page.tsx`. At the top, after the existing imports, add:

```ts
import { expireStaleEstimates } from "@/lib/expire-stale-estimates";
```

Inside `DashboardPage`, immediately after the auth check (`if (!session?.user) redirect("/login");`), add:

```ts
try {
  await expireStaleEstimates();
} catch (err) {
  console.error("expireStaleEstimates failed:", err);
}
```

- [ ] **Step 2: Drop `APPROVED` from inquiry filter and add `EXPIRED` to archive filter**

In the same file, find these four lines (currently lines ~54-59):

```ts
const inquiryProjects = allProjectsWithTotals.filter((p) =>
  ["NEW", "BRIEFED", "ESTIMATING", "APPROVED"].includes(p.status),
);
const inProgressProjects = allProjectsWithTotals.filter((p) => p.status === "IN_PROGRESS");
const completionProjects = allProjectsWithTotals.filter((p) => p.status === "DELIVERED");
const archiveProjects = allProjectsWithTotals.filter((p) => p.status === "CLOSED");
```

Replace them with:

```ts
const inquiryProjects = allProjectsWithTotals.filter((p) =>
  ["NEW", "BRIEFED", "ESTIMATING"].includes(p.status),
);
const inProgressProjects = allProjectsWithTotals.filter((p) => p.status === "IN_PROGRESS");
const completionProjects = allProjectsWithTotals.filter((p) => p.status === "DELIVERED");
const archiveProjects = allProjectsWithTotals.filter((p) =>
  ["CLOSED", "EXPIRED"].includes(p.status),
);
```

- [ ] **Step 3: Remove the now-unused `staleCutoff`/`inquiryStale`/`STALE_DAYS` block**

In the same file, delete these lines (currently lines ~13 and ~62-65):

```ts
const STALE_DAYS = 30;
```

```ts
// eslint-disable-next-line react-hooks/purity
const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
const inquiryStale = inquiryProjects.filter(
  (p) => p.status === "ESTIMATING" && p.updatedAt < staleCutoff,
);
```

Then update the `<HubInquiry>` invocation — replace `staleProjects={inquiryStale}` with nothing (the prop is being removed in Task 6):

```tsx
{active === "inquiry" && (
  <HubInquiry projects={inquiryProjects} />
)}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build will fail because `HubInquiry`'s prop type still requires `staleProjects`. Continue to Task 6 to fix that. **Do not commit yet.**

If you want to keep commits clean per task: temporarily pass `staleProjects={[]}` so the build passes, then remove it in Task 6. The choice is yours; the plan assumes you commit after each task and chooses the temporary-stub approach below.

- [ ] **Step 5: Temporarily stub `staleProjects={[]}` so this task can build and commit**

In `src/app/(dashboard)/page.tsx`, change the inquiry hub render to:

```tsx
{active === "inquiry" && (
  <HubInquiry projects={inquiryProjects} staleProjects={[]} />
)}
```

This keeps the type happy for now; Task 6 removes the `staleProjects` prop entirely.

- [ ] **Step 6: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: wire expire sweep + fix dashboard status filters"
```

---

## Task 6: Refactor Hub-1 (Inquiry) to flat list

**Files:**
- Rewrite: `src/components/redesign/hubs/hub-1-inquiry.tsx`
- Modify: `src/app/(dashboard)/page.tsx` (remove the `staleProjects={[]}` stub)

- [ ] **Step 1: Replace the entire file**

Overwrite `src/components/redesign/hubs/hub-1-inquiry.tsx` with this exact content:

```tsx
// src/components/redesign/hubs/hub-1-inquiry.tsx
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { HubProjectRow, HubEmptyState, type HubProjectRowData } from "./hub-project-row";

interface Props {
  projects: HubProjectRowData[];
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubInquiry({ projects }: Props) {
  const drafts = projects.filter((p) => p.status === "NEW");
  const briefed = projects.filter((p) => p.status === "BRIEFED");
  const estimating = projects.filter((p) => p.status === "ESTIMATING");

  const pipelineValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);

  return (
    <div>
      <Cockpit
        tag="STAGE_01 · INQUIRY"
        title="Inquiry & estimation"
        tagColor="var(--color-s-estimating-fg)"
        context={
          <>
            {"// "}
            <strong className="text-ink-900 font-bold">{projects.length} ACTIVE</strong>
            {" · stale estimates auto-archive after 30 days"}
          </>
        }
      >
        <div className="grid grid-cols-4 gap-0 items-end">
          <Readout
            label="ACTIVE"
            value={pad(projects.length)}
            unit="in this hub"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="NEW"
            value={pad(drafts.length)}
            unit="awaiting brief"
            dotColor="var(--color-ink-300)"
            muted={drafts.length === 0}
          />
          <Readout
            label="BRIEFED"
            value={pad(briefed.length)}
            unit="to estimate"
            dotColor="var(--color-s-briefed)"
            muted={briefed.length === 0}
          />
          <Readout
            label="ESTIMATING"
            value={pad(estimating.length)}
            unit="awaiting client"
            dotColor="var(--color-s-estimating)"
            muted={estimating.length === 0}
          />
        </div>

        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "PIPELINE", value: fmtUSD(pipelineValue) },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {projects.length === 0 ? (
            <HubEmptyState hubLabel="inquiry" />
          ) : (
            <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden hover:border-hairline-strong transition-colors">
              {projects.map((p) => (
                <HubProjectRow key={p.id} project={p} kind="inquiry" />
              ))}
            </div>
          )}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">
                {"// INQUIRY-STAGE TOOLS"}
              </p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="📐" name="Estimate templates" desc="Save reusable phase + line-item templates per service module" />
              <GrayToolCard icon="📤" name="Send tracker" desc="See when clients open estimates, which version, how long they spent" />
              <GrayToolCard icon="⏰" name="Auto follow-up" desc="Schedule a friendly nudge if the client hasn't responded in 7 days" />
              <GrayToolCard icon="💬" name="Proposal comments" desc="Let clients leave inline comments on specific line items" />
              <GrayToolCard icon="🪞" name="Conversion analytics" desc="Which estimate sizes / clients / service modules win most often" />
              <GrayToolCard icon="📋" name="Brief templates" desc="Standard brief structure per inquiry source (WeChat, email, Lark)" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-estimating)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Pipeline value", fmtUSD(pipelineValue)],
              ["Active projects", `${projects.length}`],
              ["Auto-expire window", "30 days"],
            ].map(([l, v]) => (
              <div
                key={l}
                className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
              >
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove the temporary `staleProjects={[]}` stub from page.tsx**

Edit `src/app/(dashboard)/page.tsx`. Change:

```tsx
{active === "inquiry" && (
  <HubInquiry projects={inquiryProjects} staleProjects={[]} />
)}
```

To:

```tsx
{active === "inquiry" && <HubInquiry projects={inquiryProjects} />}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/redesign/hubs/hub-1-inquiry.tsx src/app/\(dashboard\)/page.tsx
git commit -m "refactor: hub-1 inquiry to flat list, drop stale subgroups"
```

---

## Task 7: Refactor Hub-2 (In Progress) to flat list

**Files:**
- Rewrite: `src/components/redesign/hubs/hub-2-in-progress.tsx`

- [ ] **Step 1: Replace the entire file**

Overwrite `src/components/redesign/hubs/hub-2-in-progress.tsx` with this exact content:

```tsx
// src/components/redesign/hubs/hub-2-in-progress.tsx
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { HubProjectRow, HubEmptyState, type HubProjectRowData } from "./hub-project-row";

interface ProjectLite extends HubProjectRowData {
  startDate: Date | null;
}

interface Props {
  projects: ProjectLite[];
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubInProgress({ projects }: Props) {
  const byPhase = (phase: string) => projects.filter((p) => p.executionPhase === phase);
  const recruit = byPhase("RECRUITMENT");
  const field = byPhase("FIELDWORK");
  const analyze = byPhase("ANALYSIS");
  const report = byPhase("REPORTING");

  const activeValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((s, e) => s + e.total, 0);

  const oldest = projects.reduce(
    (max, p) =>
      p.startDate
        ? // eslint-disable-next-line react-hooks/purity
          Math.max(max, Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000))
        : max,
    0,
  );

  return (
    <div>
      <Cockpit
        tag="STAGE_02 · IN PROGRESS"
        title="Execution & delivery"
        tagColor="var(--color-s-in-progress-fg)"
        context={
          <>
            {"// all "}
            <strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong>
            {" below are actively being executed"}
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="ACTIVE" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-in-progress)" />
          <Readout label="RECRUITMENT" value={pad(recruit.length)} unit="recruiting panel" dotColor="var(--color-p-recruit)" muted={recruit.length === 0} />
          <Readout label="FIELDWORK" value={pad(field.length)} unit="in field" dotColor="var(--color-p-field)" muted={field.length === 0} />
          <Readout label="ANALYSIS" value={pad(analyze.length)} unit="analyzing" dotColor="var(--color-p-analyze)" muted={analyze.length === 0} />
          <Readout label="REPORTING" value={pad(report.length)} unit="writing up" dotColor="var(--color-p-report)" muted={report.length === 0} />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "ACTIVE.VALUE", value: fmtUSD(activeValue) },
            { label: "OLDEST.START", value: oldest > 0 ? `${oldest}d ago` : "—" },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {projects.length === 0 ? (
            <HubEmptyState hubLabel="in progress" />
          ) : (
            <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
              {projects.map((p) => (
                <HubProjectRow key={p.id} project={p} kind="in-progress" />
              ))}
            </div>
          )}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{"// IN-PROGRESS TOOLS"}</p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="👥" name="Team management" desc="Assign internal team + external vendors per project" />
              <GrayToolCard icon="🤝" name="Vendor directory" desc="Reusable vendor profiles with rate cards and past projects" />
              <GrayToolCard icon="✅" name="Deliverable tracker" desc="Per-line deliverables, owner, status, due date — auto-built from estimate" />
              <GrayToolCard icon="⏱" name="Time logging" desc="Track hours per person per project for billing & capacity" />
              <GrayToolCard icon="📥" name="Vendor invoice review" desc="Receive and approve vendor invoices linked to your line items" />
              <GrayToolCard icon="🗓" name="Phase deadlines" desc="Set and track phase-level deadlines; alert on slippage" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-in-progress)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Active value", fmtUSD(activeValue)],
              ["Avg project size", projects.length ? fmtUSD(activeValue / projects.length) : "—"],
              [
                "Largest in-flight",
                fmtUSD(Math.max(0, ...projects.flatMap((p) => p.estimates.filter((e) => e.isApproved).map((e) => e.total)))),
              ],
            ].map(([l, v]) => (
              <div
                key={l}
                className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
              >
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-2-in-progress.tsx
git commit -m "refactor: hub-2 in-progress to flat list, drop phase subgroups"
```

---

## Task 8: Refactor Hub-3 (Completion) to flat list + wire Archive button

**Files:**
- Rewrite: `src/components/redesign/hubs/hub-3-completion.tsx`

- [ ] **Step 1: Replace the entire file**

Overwrite `src/components/redesign/hubs/hub-3-completion.tsx` with this exact content:

```tsx
// src/components/redesign/hubs/hub-3-completion.tsx
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { HubProjectRow, HubEmptyState, type HubProjectRowData } from "./hub-project-row";
import { ArchiveButton } from "./archive-button";

interface InvoiceLite {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: Date | null;
  paidDate: Date | null;
}

interface ProjectLite extends HubProjectRowData {
  invoices: InvoiceLite[];
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
}

interface Props {
  projects: ProjectLite[];
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubCompletion({ projects }: Props) {
  const receivable = projects
    .flatMap((p) => p.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE"))
    .reduce((s, i) => s + i.total, 0);

  const allPaid = (p: ProjectLite) =>
    p.invoices.length > 0 && p.invoices.every((i) => i.status === "PAID");

  const readyToArchive = projects.filter(allPaid).length;

  return (
    <div>
      <Cockpit
        tag="STAGE_03 · COMPLETION"
        title="Reconciliation & final invoice"
        tagColor="var(--color-s-delivered-fg)"
        context={
          <>
            {"// all "}
            <strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong>
            {" below have delivered work"}
          </>
        }
      >
        <div className="grid grid-cols-3 gap-0 items-end">
          <Readout label="DELIVERED" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-delivered)" />
          <Readout label="RECEIVABLE" value={fmtUSD(receivable)} unit="awaiting payment" />
          <Readout label="READY.ARCHIVE" value={pad(readyToArchive)} unit="all invoices paid" dotColor="var(--color-s-delivered)" muted={readyToArchive === 0} />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "RECEIVABLE", value: fmtUSD(receivable) },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {projects.length === 0 ? (
            <HubEmptyState hubLabel="completion" />
          ) : (
            <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
              {projects.map((p) => {
                const draftInv = p.invoices.find((i) => i.status === "DRAFT");
                const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
                return (
                  <HubProjectRow
                    key={p.id}
                    project={p}
                    kind="completion"
                    trailing={
                      <span className="flex gap-1">
                        {draftInv ? (
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
                          >
                            Send invoice
                          </button>
                        ) : null}
                        {sentInv ? (
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {allPaid(p) ? <ArchiveButton projectId={p.id} /> : null}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{"// COMPLETION-STAGE TOOLS"}</p>
              <span
                className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
                style={{ background: "var(--color-ink-300)" }}
              >
                UNDER DEVELOPMENT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="🔁" name="Auto-reconciliation" desc="Pre-fill delivered = planned for done deliverables" />
              <GrayToolCard icon="📊" name="Variance reports" desc="Per-project and rolled-up variance by service module" />
              <GrayToolCard icon="🔔" name="Payment reminders" desc="Automatic email cadence to clients with unpaid invoices" />
              <GrayToolCard icon="🏦" name="Bank-feed reconciliation" desc="Match incoming payments to invoices automatically" />
              <GrayToolCard icon="📄" name="Invoice templates" desc="Per-client invoice formats with custom branding" />
              <GrayToolCard icon="💱" name="Currency conversion" desc="USD/CNY auto-rate snapshots for RMB-duplicate invoices" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-delivered)" }} />
              {"// HUB STATS · LIVE"}
            </p>
            {[
              ["Receivable (unpaid)", fmtUSD(receivable)],
              ["Ready to archive", `${readyToArchive} / ${projects.length}`],
            ].map(([l, v]) => (
              <div
                key={l}
                className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
              >
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note: per spec, "Send invoice" and "Mark paid" stay as decorative `<button type="button">` (no handler). They render conditionally so they only show when the invoice is in a relevant state (`Send invoice` when there is a DRAFT invoice; `Mark paid` when there is a SENT/OVERDUE invoice). The variance-chip UI is dropped. The Archive button only renders when **every** non-deleted invoice on the project is `PAID`.

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-3-completion.tsx
git commit -m "refactor: hub-3 completion to flat list, wire archive button"
```

---

## Task 9: Refactor Hub-4 (Archive) to include `EXPIRED` + chip

**Files:**
- Modify: `src/components/redesign/hubs/hub-4-archive.tsx`

- [ ] **Step 1: Replace the placeholder pill with a closed/expired chip**

In the same file, find the inner `<Link>` block inside the year loop (currently around lines 128-149). The existing markup uses a "// no feedback yet" pill placeholder. Replace it with a closed/expired chip.

Find this block:

```tsx
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ border: "1px dashed var(--color-ink-300)", color: "var(--color-ink-400)" }}>
  {"// no feedback yet"}
</span>
```

Replace it with:

```tsx
{p.status === "EXPIRED" ? (
  <span
    className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
    style={{ background: "#F4F4F5", color: "#71717A" }}
  >
    <span className="w-1 h-1 rounded-full" style={{ background: "#A1A1AA" }} />
    EXPIRED
  </span>
) : (
  <span
    className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
    style={{ background: "var(--color-s-closed-bg)", color: "var(--color-s-closed-fg)" }}
  >
    <span className="w-1 h-1 rounded-full" style={{ background: "var(--color-s-closed)" }} />
    CLOSED
  </span>
)}
```

- [ ] **Step 2: Update the dot color on the row's left bar to reflect EXPIRED**

In the same file, find:

```tsx
<span className="w-1 h-9 rounded-full" style={{ background: "var(--color-s-closed)" }} />
```

Replace with:

```tsx
<span
  className="w-1 h-9 rounded-full"
  style={{ background: p.status === "EXPIRED" ? "#A1A1AA" : "var(--color-s-closed)" }}
/>
```

- [ ] **Step 3: Update the `archived <date>` label to read `expired <date>` for EXPIRED rows**

In the same row, find:

```tsx
{p.client.company} · archived {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
```

Replace with:

```tsx
{p.client.company} · {p.status === "EXPIRED" ? "expired" : "archived"} {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/redesign/hubs/hub-4-archive.tsx
git commit -m "feat: hub-4 archive shows EXPIRED projects with chip"
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the project statuses section**

Open `CLAUDE.md`. Find the `### Project statuses (6 stages)` heading and the line below it:

```
`NEW → BRIEFED → ESTIMATING → IN_PROGRESS → DELIVERED → CLOSED`
```

Replace the heading and that line with:

```markdown
### Project statuses (7 stages)

`NEW → BRIEFED → ESTIMATING → IN_PROGRESS → DELIVERED → CLOSED`

Side-track: `ESTIMATING → EXPIRED` (auto, see auto-archive rule below)
```

- [ ] **Step 2: Add the auto-archive rule under Transitions**

In the same `Transitions:` list (just below), add a new bullet after the `DELIVERED → CLOSED` line:

```markdown
- `ESTIMATING → EXPIRED` (auto): on dashboard load, if every non-deleted SENT estimate on the project has `updatedAt > 30 days ago` and no estimate is approved. Helper: `src/lib/expire-stale-estimates.ts`. EXPIRED projects appear in the Archive hub.
```

- [ ] **Step 3: Build + lint to make sure nothing else broke**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document EXPIRED status and auto-archive sweep"
```

---

## Task 11: Manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server boots on `localhost:3000`. Log in as `yushi@ubinsights.com` / `ubi12345`.

- [ ] **Step 2: Visit `/` and verify each hub shows projects**

For every existing project in the database, confirm it appears in exactly one hub list:
- `NEW` / `BRIEFED` / `ESTIMATING` → Inquiry hub
- `IN_PROGRESS` → In Progress hub
- `DELIVERED` → Completion hub
- `CLOSED` / `EXPIRED` → Archive hub

The Inquiry hub should show a single flat list (no BRIEFED/ESTIMATING/APPROVED subgroups). The In Progress hub should show one flat list (no phase subgroups, including any project with `executionPhase = null` which previously vanished). The Completion hub should show one flat list (no reconcile/awaiting/paid subgroups).

- [ ] **Step 3: Verify the auto-archive sweep**

Pick a project in `ESTIMATING` with at least one estimate whose `status = SENT`. Open Prisma Studio (`npx prisma studio`), backdate that estimate's `updatedAt` to 35 days ago, then refresh the dashboard.

Expected:
- Project status flips to `EXPIRED`.
- Project disappears from the Inquiry hub.
- Project appears in the Archive hub with the gray `EXPIRED` chip.

- [ ] **Step 4: Verify the Archive button on Completion hub**

Find a `DELIVERED` project whose every invoice is `PAID` (or temporarily mark its invoice PAID via Prisma Studio). On the dashboard Completion hub, click `Archive →`.

Expected:
- Button shows `Archiving…`.
- Page refreshes; project disappears from Completion and appears in Archive with the green `CLOSED` chip.
- Project's `status` is now `CLOSED` in the database.

- [ ] **Step 5: Verify decorative buttons are present but inert**

On Completion rows that have a DRAFT invoice, the "Send invoice" button should render but do nothing on click. On rows with a SENT/OVERDUE invoice, "Mark paid" renders but does nothing. On rows where every invoice is PAID, the wired-up "Archive →" button renders.

- [ ] **Step 6: Final commit if anything was tweaked**

If any small fixes were needed during smoke testing, commit them now. Otherwise this task is done.

---

## Summary of commits

After completing all tasks, the branch should have ~10 commits:

1. `feat: add EXPIRED project status`
2. `feat: add expireStaleEstimates sweep helper`
3. `feat: add shared HubProjectRow component`
4. `feat: add ArchiveButton client component`
5. `feat: wire expire sweep + fix dashboard status filters`
6. `refactor: hub-1 inquiry to flat list, drop stale subgroups`
7. `refactor: hub-2 in-progress to flat list, drop phase subgroups`
8. `refactor: hub-3 completion to flat list, wire archive button`
9. `feat: hub-4 archive shows EXPIRED projects with chip`
10. `docs: document EXPIRED status and auto-archive sweep`

# Visual Redesign with Phase Hubs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the entire application around a warm cream canvas, near-black ink, terracotta accent, saturated phase-coded status palette, JetBrains Mono cockpit pattern, and a phase-hub-based dashboard. Replace the existing single-pane dashboard with four hub views (Inquiry, In Progress, Completion, Archive). Build the two highest-leverage Hub 3 workflows (Confirm Actuals, Send Invoice) as full-page flows.

**Architecture:** Visual-only changes on top of the 2026-04-27 lifecycle redesign. No new API routes, no Prisma schema changes, no business-logic changes. New design tokens go in `src/app/globals.css` via Tailwind v4's `@theme inline`. New shared primitives (`StatusPill`, `Cockpit`, `HubTabBar`, `UnderDevToast`, `GrayToolCard`) live under `src/components/redesign/`. Existing dashboard, project hub, and Delivery & Sign-off pages are rewritten. Future-only tools (deliverables, vendors, team management) appear as gray cards that toast on click.

**Tech Stack:** Next.js 16 App Router (TypeScript), Tailwind CSS v4 (`@theme` syntax in globals.css), shadcn/ui primitives kept as-is, NextAuth v5, Prisma 7 + PostgreSQL (read-only for this redesign), Inter (already loaded) + JetBrains Mono (added via `next/font/google`), Sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-04-28-visual-redesign-with-hubs-design.md`

---

## File map

**Tokens & fonts:**
- Modify: `src/app/layout.tsx` — add JetBrains Mono via `next/font/google`
- Modify: `src/app/globals.css` — add new color tokens under `@theme inline`

**Shared primitives (new):**
- Create: `src/components/redesign/status-pill.tsx` — pill-dot + label + bg/fg, status-aware
- Create: `src/components/redesign/cockpit.tsx` — Readout, StatusRow, CockpitFrame
- Create: `src/components/redesign/hub-tab-bar.tsx` — pill-style hub toggle with status-light dot
- Create: `src/components/redesign/under-dev-toast.tsx` — wrapper around Sonner with `UnderDev` helper
- Create: `src/components/redesign/gray-tool-card.tsx` — dashed-grayscale tool card
- Create: `src/components/redesign/page-shell.tsx` — `Crumbs`, `PageHeader` helpers

**Sidebar & shell:**
- Modify: `src/components/layout/sidebar.tsx` — wordmark logo, mono section labels, lighter density
- Modify: `src/app/(dashboard)/layout.tsx` — switch background to `--color-canvas`, remove max-w cap on dashboard surface

**Dashboard hubs:**
- Rewrite: `src/app/(dashboard)/page.tsx` — tabbed hub container; reads `?hub=` URL param, dispatches to per-hub component
- Create: `src/components/redesign/hubs/hub-1-inquiry.tsx`
- Create: `src/components/redesign/hubs/hub-2-in-progress.tsx`
- Create: `src/components/redesign/hubs/hub-3-completion.tsx`
- Create: `src/components/redesign/hubs/hub-4-archive.tsx`

**Project detail:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx` — new visual treatment, stage-aware tab labels
- Modify: `src/components/projects/project-status-stepper.tsx` — port to the new 4-stage card row from §7.1 (replaces the existing 7-step UI)
- Modify: `src/components/projects/project-hub-tabs.tsx` — restyle (underline tabs, mono counts)

**Confirm Actuals & Send Invoice:**
- Replace: `src/components/projects/delivery-signoff-tab.tsx` — full page rewrite as Confirm Actuals (line-by-line variance editor)
- Create: `src/components/invoices/send-invoice-page.tsx` — new full-page send flow
- Create: `src/app/(dashboard)/invoices/[id]/send/page.tsx` — route hosting Send Invoice

**List pages:**
- Modify: `src/app/(dashboard)/projects/page.tsx` — restyle to new tokens; left-rail status, mono numbers
- Modify: `src/app/(dashboard)/estimates/page.tsx`, `src/app/(dashboard)/invoices/page.tsx`, `src/app/(dashboard)/clients/page.tsx` — light visual pass

**Reference mockups (consult during implementation):**
- `.superpowers/brainstorm/53352-1777404878/content/15-hub1-cockpit-v3.html`
- `.superpowers/brainstorm/53352-1777404878/content/16-hub2-in-progress.html`
- `.superpowers/brainstorm/53352-1777404878/content/18-hub3-completion.html`
- `.superpowers/brainstorm/53352-1777404878/content/19-hub4-archive.html`
- `.superpowers/brainstorm/53352-1777404878/content/20-confirm-actuals.html`
- `.superpowers/brainstorm/53352-1777404878/content/21-send-invoice.html`

---

## Verification commands

```bash
# Type-check (fast, primary gate)
npx tsc --noEmit

# Production build (slower; static-export step has known timeouts on /clients and /templates from baseline)
npm run build

# Dev server
npm run dev   # localhost:3000
# Log in as yushi@ubinsights.com / ubi12345

# Lint
npm run lint
```

When a task says "verify in browser", the dev server runs at localhost:3000 and a seeded sample project (`PRJ-2026-001`) is available with at least one approved estimate. Most tasks below also include the URL of the most relevant mockup at `localhost:62463` (the running brainstorm visual companion, if still up) for visual fidelity checks.

---

## Branching

Set up a fresh feature branch off the current `redesign/project-lifecycle` branch before Task 1:

```bash
git checkout redesign/project-lifecycle
git pull --ff-only origin redesign/project-lifecycle 2>/dev/null || true
git checkout -b redesign/visual-hubs
```

Each task in this plan is a single commit on `redesign/visual-hubs`. The branch is reviewed and merged as one PR after Task 23 (final smoke test) passes.

---

## Phase 1 — Foundations

### Task 1: Load JetBrains Mono via next/font

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the JetBrains_Mono import and assign a CSS variable**

In `src/app/layout.tsx`, change the imports and font setup. Find:

```tsx
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
```

Replace with:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});
```

- [ ] **Step 2: Apply both font CSS variables to `<body>`**

In the same file, change:

```tsx
<body className={inter.className}>
```

to:

```tsx
<body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
```

(`font-sans` is a Tailwind class that uses `--font-sans` from the theme — wired in Task 2.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(fonts): load JetBrains Mono alongside Inter via next/font"
```

---

### Task 2: New color tokens in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the redesign tokens to `@theme inline`**

Open `src/app/globals.css`. Inside the existing `@theme inline { … }` block, add the following AFTER the existing `--font-mono: …` line (this overrides `--font-mono` from Geist to JetBrains Mono via the variable wired in Task 1):

```css
  /* ─── 2026 Visual Redesign tokens ─── */
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-mono), "JetBrains Mono", ui-monospace, monospace;

  /* Surfaces */
  --color-canvas: #F8F5EE;
  --color-canvas-cool: #F0EDE5;
  --color-card-rd: #FFFFFF;

  /* Ink */
  --color-ink-900: #0F1729;
  --color-ink-700: #2A3548;
  --color-ink-500: #5A6478;
  --color-ink-400: #7A8395;
  --color-ink-300: #A0A8B8;
  --color-ink-200: #C4CAD6;

  /* Hairlines */
  --color-hairline: #ECE7DD;
  --color-hairline-strong: #D9D2C2;

  /* Accent — terracotta */
  --color-accent: #D9522B;
  --color-accent-strong: #BC4220;
  --color-accent-soft: #FBE8DE;

  /* Warning — stale */
  --color-warn: #C97520;
  --color-warn-bg: #FCEDD9;
  --color-warn-fg: #92511A;

  /* Status palette — saturated */
  --color-s-new: #94A3B8;
  --color-s-new-bg: #EFF1F5;
  --color-s-new-fg: #475569;
  --color-s-briefed: #64748B;
  --color-s-briefed-bg: #E5E9F0;
  --color-s-briefed-fg: #334155;
  --color-s-estimating: #3B82F6;
  --color-s-estimating-bg: #DBEAFE;
  --color-s-estimating-fg: #1D4ED8;
  --color-s-approved: #10B981;
  --color-s-approved-bg: #D1FAE5;
  --color-s-approved-fg: #047857;
  --color-s-in-progress: #6366F1;
  --color-s-in-progress-bg: #E0E7FF;
  --color-s-in-progress-fg: #4338CA;
  --color-s-delivered: #059669;
  --color-s-delivered-bg: #C8F0DC;
  --color-s-delivered-fg: #065F46;
  --color-s-closed: #71717A;
  --color-s-closed-bg: #E7E5DF;
  --color-s-closed-fg: #3F3F46;

  /* Execution-phase palette (Hub 2 only) */
  --color-p-recruit: #A855F7;
  --color-p-recruit-bg: #F3E8FF;
  --color-p-recruit-fg: #6B21A8;
  --color-p-field: #06B6D4;
  --color-p-field-bg: #CFFAFE;
  --color-p-field-fg: #155E75;
  --color-p-analyze: #F59E0B;
  --color-p-analyze-bg: #FEF3C7;
  --color-p-analyze-fg: #92400E;
  --color-p-report: #EC4899;
  --color-p-report-bg: #FCE7F3;
  --color-p-report-fg: #9F1239;

  /* Variance */
  --color-var-under: #059669;
  --color-var-over: #DC2626;
```

- [ ] **Step 2: Add the blink keyframe and a `tabular-nums` utility class outside the `@theme` block**

Append to the end of `globals.css`:

```css
@keyframes rd-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.rd-blink {
  animation: rd-blink 2.4s ease-in-out infinite;
}

.rd-tabular {
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify Tailwind compiles tokens**

Start the dev server briefly:

```bash
npm run dev
```

Open localhost:3000. The page should still render (existing colors are unchanged for now). In devtools, inspect any element and look at computed styles — `bg-canvas`, `text-ink-900` etc. should be available as classes (they will be used in later tasks). Stop the dev server.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add 2026 redesign color tokens and blink keyframe"
```

---

### Task 3: Add `currencySymbol` to status-helper utility (verify existing)

`src/lib/currency.ts` already exports `currencySymbol(code: string)` (USD, CNY, EUR, GBP, HKD, JPY). This task just verifies its presence and creates a small companion helper for status colors.

**Files:**
- Create: `src/lib/redesign-tokens.ts`

- [ ] **Step 1: Create the helper**

```ts
// src/lib/redesign-tokens.ts
// Helpers for mapping a project / invoice / phase status to its color tokens.

export type ProjectStatus =
  | "NEW"
  | "BRIEFED"
  | "ESTIMATING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CLOSED";

const STATUS_TOKENS: Record<string, { bg: string; fg: string; dot: string }> = {
  NEW:         { bg: "var(--color-s-new-bg)",         fg: "var(--color-s-new-fg)",         dot: "var(--color-s-new)" },
  BRIEFED:     { bg: "var(--color-s-briefed-bg)",     fg: "var(--color-s-briefed-fg)",     dot: "var(--color-s-briefed)" },
  ESTIMATING:  { bg: "var(--color-s-estimating-bg)",  fg: "var(--color-s-estimating-fg)",  dot: "var(--color-s-estimating)" },
  APPROVED:    { bg: "var(--color-s-approved-bg)",    fg: "var(--color-s-approved-fg)",    dot: "var(--color-s-approved)" },
  IN_PROGRESS: { bg: "var(--color-s-in-progress-bg)", fg: "var(--color-s-in-progress-fg)", dot: "var(--color-s-in-progress)" },
  DELIVERED:   { bg: "var(--color-s-delivered-bg)",   fg: "var(--color-s-delivered-fg)",   dot: "var(--color-s-delivered)" },
  CLOSED:      { bg: "var(--color-s-closed-bg)",      fg: "var(--color-s-closed-fg)",      dot: "var(--color-s-closed)" },
};

export function statusTokens(status: string): { bg: string; fg: string; dot: string } {
  return (
    STATUS_TOKENS[status] ?? {
      bg: "var(--color-canvas-cool)",
      fg: "var(--color-ink-500)",
      dot: "var(--color-ink-300)",
    }
  );
}

const PHASE_TOKENS: Record<string, { bg: string; fg: string; dot: string }> = {
  RECRUITMENT: { bg: "var(--color-p-recruit-bg)", fg: "var(--color-p-recruit-fg)", dot: "var(--color-p-recruit)" },
  FIELDWORK:   { bg: "var(--color-p-field-bg)",   fg: "var(--color-p-field-fg)",   dot: "var(--color-p-field)" },
  ANALYSIS:    { bg: "var(--color-p-analyze-bg)", fg: "var(--color-p-analyze-fg)", dot: "var(--color-p-analyze)" },
  REPORTING:   { bg: "var(--color-p-report-bg)",  fg: "var(--color-p-report-fg)",  dot: "var(--color-p-report)" },
};

export function phaseTokens(phase: string): { bg: string; fg: string; dot: string } {
  return (
    PHASE_TOKENS[phase] ?? {
      bg: "var(--color-canvas-cool)",
      fg: "var(--color-ink-500)",
      dot: "var(--color-ink-300)",
    }
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/redesign-tokens.ts
git commit -m "feat(redesign): add status and phase token helper"
```

---

## Phase 2 — Shared primitives

### Task 4: `StatusPill` component

A small pill that renders a phase-coded dot + label, used in dozens of places (project rows, eyebrows, hub tabs, etc.).

**Files:**
- Create: `src/components/redesign/status-pill.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/redesign/status-pill.tsx
import { statusTokens } from "@/lib/redesign-tokens";
import { cn } from "@/lib/utils";

interface Props {
  status: string;
  /** Override label; defaults to formatted status (e.g. "IN_PROGRESS" → "In Progress") */
  label?: string;
  /** Size: sm (default) or xs */
  size?: "xs" | "sm";
  className?: string;
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

export function StatusPill({ status, label, size = "sm", className }: Props) {
  const t = statusTokens(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]",
        className,
      )}
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      <span
        className="rounded-full"
        style={{
          width: size === "sm" ? 5 : 4,
          height: size === "sm" ? 5 : 4,
          backgroundColor: t.dot,
        }}
      />
      {label ?? formatStatus(status)}
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/status-pill.tsx
git commit -m "feat(redesign): StatusPill primitive"
```

---

### Task 5: `UnderDevToast` helper

Tiny wrapper around Sonner that surfaces "[Feature] is under development" toasts on click of any gray placeholder.

**Files:**
- Create: `src/components/redesign/under-dev-toast.tsx`

- [ ] **Step 1: Write the helper**

```tsx
// src/components/redesign/under-dev-toast.tsx
"use client";

import { toast } from "sonner";

export function showUnderDevToast(featureName: string) {
  toast(
    <div>
      <div className="font-medium">{featureName} is under development.</div>
      <div className="text-[11px] text-white/60 font-mono mt-0.5">// Coming in a future release</div>
    </div>,
    {
      duration: 2400,
      style: {
        background: "var(--color-ink-900)",
        color: "white",
        border: "none",
        boxShadow: "0 12px 32px -8px rgba(15, 23, 41, 0.4)",
        fontSize: "13px",
        fontWeight: 500,
      },
    }
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/under-dev-toast.tsx
git commit -m "feat(redesign): under-dev toast helper"
```

---

### Task 6: `Cockpit` primitives

Three small components that compose the cockpit header pattern: `Cockpit` (frame with top/bottom borders), `Readout` (one numerical readout cell), `StatusRow` (mono key-value row).

**Files:**
- Create: `src/components/redesign/cockpit.tsx`

- [ ] **Step 1: Write the components**

```tsx
// src/components/redesign/cockpit.tsx
import { cn } from "@/lib/utils";

interface CockpitProps {
  /** mono uppercase tag, e.g. "STAGE_01 · INQUIRY" */
  tag: string;
  /** plain Inter title, e.g. "Inquiry & estimation" */
  title: string;
  /** trailing context line (rendered in mono) */
  context?: React.ReactNode;
  /** primary status color used for the leading bullet */
  tagColor?: string;
  children: React.ReactNode;
}

export function Cockpit({ tag, title, context, tagColor = "var(--color-ink-700)", children }: CockpitProps) {
  return (
    <section className="border-t border-ink-900 border-b border-hairline pt-4 pb-5 mb-7">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <span
            className="font-mono text-[10px] font-bold tracking-[0.10em] uppercase inline-flex items-center gap-2 mr-2"
            style={{ color: tagColor }}
          >
            <span aria-hidden style={{ color: tagColor }} className="text-[8px]">●</span>
            {tag}
          </span>
          <span className="text-[22px] font-bold tracking-[-0.02em] text-ink-900">{title}</span>
        </div>
        {context ? (
          <span className="font-mono text-[10px] text-ink-400 tracking-[0.04em] inline-flex items-center gap-3">
            {context}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

interface ReadoutProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** dot color */
  dotColor?: string;
  /** make the dot blink */
  blink?: boolean;
  /** muted (zero/empty state) */
  muted?: boolean;
  /** warning tone */
  warn?: boolean;
  className?: string;
}

export function Readout({ label, value, unit, dotColor, blink, muted, warn, className }: ReadoutProps) {
  return (
    <div
      className={cn(
        "px-4 first:pl-0 last:pr-0 last:border-r-0 border-r border-hairline cursor-pointer hover:bg-black/[0.02] transition-colors",
        className,
      )}
    >
      <p className="font-mono text-[9px] font-bold tracking-[0.08em] uppercase text-ink-400 mb-2 flex items-center gap-1.5">
        {dotColor ? (
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", blink && "rd-blink")}
            style={{ backgroundColor: dotColor, boxShadow: `0 0 0 2px ${dotColor.replace(")", "-bg)")}` }}
          />
        ) : null}
        {label}
      </p>
      <div
        className={cn(
          "font-sans text-[32px] font-extrabold tracking-[-0.03em] leading-none rd-tabular mb-1",
          muted && "text-ink-300",
          warn && "text-warn-fg",
          !muted && !warn && "text-ink-900",
        )}
      >
        {value}
      </div>
      {unit ? <div className="font-mono text-[10px] text-ink-400 tracking-[0.04em]">{unit}</div> : null}
    </div>
  );
}

interface StatusRowProps {
  cells: { label: string; value: React.ReactNode; warn?: boolean; under?: boolean }[];
  trailing?: React.ReactNode;
}

export function StatusRow({ cells, trailing }: StatusRowProps) {
  return (
    <div className="mt-4 pt-3.5 border-t border-dashed border-hairline flex gap-4 flex-wrap font-mono text-[11px] text-ink-500 tracking-[0.02em]">
      {cells.map((c, i) => (
        <span key={i}>
          {c.label}: <strong className={cn("text-ink-900 font-bold", c.under && "text-var-under", c.warn && "text-warn-fg")}>{c.value}</strong>
        </span>
      ))}
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}
```

NOTE: Tailwind v4 lets you use any token defined under `@theme` as a class — `bg-canvas`, `text-ink-700`, `border-hairline`, `text-var-under` etc. all resolve to the variables added in Task 2. If a class doesn't resolve at runtime, double-check the token name in `globals.css`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/cockpit.tsx
git commit -m "feat(redesign): Cockpit, Readout, and StatusRow primitives"
```

---

### Task 7: `HubTabBar` component

The pill-style hub toggle at the top of the dashboard. Reads `hub` from the URL.

**Files:**
- Create: `src/components/redesign/hub-tab-bar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/redesign/hub-tab-bar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type HubKey = "inquiry" | "in-progress" | "completion" | "archive";

interface HubMeta {
  key: HubKey;
  label: string;
  count: number;
  /** dot color when not active */
  dotColor: string;
  /** glow color when active */
  activeGlow: string;
}

interface Props {
  hubs: HubMeta[];
  active: HubKey;
}

export function HubTabBar({ hubs, active }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const setHub = (key: HubKey) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("hub", key);
    router.push(`?${next.toString()}`);
  };

  return (
    <div
      className="flex gap-1 mb-7 p-1 bg-card-rd border border-hairline rounded-[10px] w-fit"
      style={{ boxShadow: "0 1px 2px rgba(15,23,41,0.04)" }}
    >
      {hubs.map((h) => {
        const isActive = h.key === active;
        return (
          <button
            key={h.key}
            onClick={() => setHub(h.key)}
            className={cn(
              "px-4 py-2 rounded-[7px] text-xs font-semibold tracking-[-0.005em] inline-flex items-center gap-2 transition-colors",
              isActive ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900",
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={
                isActive
                  ? { background: h.activeGlow, boxShadow: `0 0 6px ${h.activeGlow}80` }
                  : { background: h.dotColor }
              }
            />
            {h.label}
            <span
              className={cn(
                "font-mono text-[11px] ml-1",
                isActive ? "text-white/55" : "text-ink-300",
              )}
            >
              {h.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hub-tab-bar.tsx
git commit -m "feat(redesign): HubTabBar with URL-param hub toggle"
```

---

### Task 8: `GrayToolCard` component

The dashed-grayscale tool card that toasts "under development" on click.

**Files:**
- Create: `src/components/redesign/gray-tool-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/redesign/gray-tool-card.tsx
"use client";

import { showUnderDevToast } from "./under-dev-toast";

interface Props {
  icon: string; // emoji or short glyph
  name: string;
  desc: string;
}

export function GrayToolCard({ icon, name, desc }: Props) {
  return (
    <button
      type="button"
      onClick={() => showUnderDevToast(name)}
      className="text-left bg-white/50 border border-dashed border-ink-200 rounded-[10px] px-4 py-3.5 cursor-pointer transition-all hover:bg-white/80 hover:border-ink-300 hover:-translate-y-0.5"
      style={{ filter: "grayscale(0.7)" }}
    >
      <div className="text-base mb-1.5 text-ink-400" style={{ filter: "grayscale(1)" }}>
        {icon}
      </div>
      <div className="text-xs font-bold text-ink-500 tracking-[-0.005em] mb-1">{name}</div>
      <div className="text-[11px] text-ink-400 leading-[1.5]">{desc}</div>
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/gray-tool-card.tsx
git commit -m "feat(redesign): GrayToolCard with under-dev toast on click"
```

---

## Phase 3 — Layout shell

### Task 9: Restyle the Sidebar

Wordmark logo with terracotta dot, mono section labels, lighter density. Existing nav routes stay; existing role-gated visibility logic stays.

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Read the existing file**

```bash
cat src/components/layout/sidebar.tsx
```

The existing sidebar accepts `{ userRole, userName }` props. Keep the props the same. Restructure the visual treatment.

- [ ] **Step 2: Replace the visual layer**

Rewrite the file's render output to match this shape (preserve any role-based filtering of nav items). The exact list of nav items may already exist — keep them; only the visual scaffolding changes.

```tsx
// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const MAIN_NAV = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/projects", label: "Projects", icon: "▢" },
  { href: "/estimates", label: "Estimates", icon: "≡" },
  { href: "/invoices", label: "Invoices", icon: "$" },
  { href: "/clients", label: "Clients", icon: "⚇" },
];

const ADMIN_NAV = [
  { href: "/templates", label: "Templates", icon: "⊟", roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: "⚙", roles: ["ADMIN"] },
];

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <aside className="w-[200px] shrink-0 px-5.5 py-7 border-r border-hairline">
      <Link href="/" className="inline-flex items-baseline gap-0.5 mb-7">
        <span className="text-[17px] font-extrabold tracking-[-0.04em] text-ink-900">
          ubinsights
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full -translate-y-px"
          style={{ background: "var(--color-accent)" }}
        />
      </Link>

      <div className="mb-5.5">
        <div className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ink-300 px-2.5 pb-2">
          // Main
        </div>
        {MAIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] mb-px transition-colors",
              isActive(item.href)
                ? "bg-ink-900/[0.08] text-ink-900 font-medium"
                : "text-ink-700 hover:bg-ink-900/[0.04]",
            )}
          >
            <span
              className={cn(
                "w-3.5 text-center",
                isActive(item.href) ? "text-ink-900" : "text-ink-400",
              )}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {userRole === "ADMIN" ? (
        <div className="mb-5.5">
          <div className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-ink-300 px-2.5 pb-2">
            // Admin
          </div>
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] mb-px transition-colors",
                isActive(item.href)
                  ? "bg-ink-900/[0.08] text-ink-900 font-medium"
                  : "text-ink-700 hover:bg-ink-900/[0.04]",
              )}
            >
              <span
                className={cn(
                  "w-3.5 text-center",
                  isActive(item.href) ? "text-ink-900" : "text-ink-400",
                )}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
```

If the existing sidebar has additional nav items (e.g., Activity, Contracts, Contract Templates), preserve them — add them under the appropriate section using the same visual pattern.

- [ ] **Step 3: Type-check and verify in browser**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000. Sidebar should render with the new wordmark + mono labels. Active page should be highlighted. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(redesign): Sidebar wordmark logo and mono section labels"
```

---

### Task 10: Update dashboard layout wrapper

Switch the body background from `#f8f9fa` to the canvas color, and remove the `max-w-7xl` cap on the dashboard surface so cockpit headers can fill the available space.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Replace the wrapper**

Find the existing `<main>` block:

```tsx
<main className="flex-1 overflow-y-auto bg-[#f8f9fa]">
  <div className="max-w-7xl mx-auto px-8 py-8">
    <ContractStoreInitializer />
    {children}
  </div>
</main>
```

Replace with:

```tsx
<main className="flex-1 overflow-y-auto" style={{ background: "var(--color-canvas)" }}>
  <div className="max-w-[1320px] mx-auto px-12 py-8">
    <ContractStoreInitializer />
    {children}
  </div>
</main>
```

(`1320px` matches the mockup max-width; px-12 corresponds to the 48px gutters used in the cockpit.)

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000. The page surface should now have the warm cream background. Existing dashboard content still renders — possibly with broken alignment due to width change, that's fine, we replace the dashboard in Task 11.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(dashboard)/layout.tsx'
git commit -m "feat(redesign): canvas-color wrapper for dashboard surface"
```

---

## Phase 4 — Dashboard with phase hubs

### Task 11: Dashboard skeleton with hub URL param

Wire the dashboard to read `?hub=` from URL and render the matching hub component. Hub components themselves are stubs in this task; they get filled in Tasks 12–15.

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Create: `src/components/redesign/hubs/hub-1-inquiry.tsx` (stub)
- Create: `src/components/redesign/hubs/hub-2-in-progress.tsx` (stub)
- Create: `src/components/redesign/hubs/hub-3-completion.tsx` (stub)
- Create: `src/components/redesign/hubs/hub-4-archive.tsx` (stub)

- [ ] **Step 1: Create stub hub files**

Each stub returns a placeholder so we can wire navigation first, fill in details next. Same template for each — change the title and component name accordingly.

```tsx
// src/components/redesign/hubs/hub-1-inquiry.tsx
import type { Project } from "@/generated/prisma/client";

interface Props {
  projects: Project[];
}

export function HubInquiry({ projects: _projects }: Props) {
  return <div className="text-ink-500 text-sm py-12">Hub 1 · Inquiry — TODO Task 12</div>;
}
```

(Repeat for HubInProgress, HubCompletion, HubArchive with appropriate filenames and titles.)

- [ ] **Step 2: Rewrite the dashboard page**

Replace `src/app/(dashboard)/page.tsx` entirely. The dashboard becomes a server component that fetches projects once and passes the right slice to the active hub.

```tsx
// src/app/(dashboard)/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HubTabBar, type HubKey } from "@/components/redesign/hub-tab-bar";
import { HubInquiry } from "@/components/redesign/hubs/hub-1-inquiry";
import { HubInProgress } from "@/components/redesign/hubs/hub-2-in-progress";
import { HubCompletion } from "@/components/redesign/hubs/hub-3-completion";
import { HubArchive } from "@/components/redesign/hubs/hub-4-archive";

export const dynamic = "force-dynamic";

const STALE_DAYS = 30;

interface PageProps {
  searchParams: Promise<{ hub?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { hub: hubParam } = await searchParams;
  const active: HubKey = (["inquiry", "in-progress", "completion", "archive"] as const).find(
    (k) => k === hubParam,
  ) ?? "inquiry";

  const allProjects = await prisma.project.findMany({
    include: {
      client: { select: { company: true } },
      estimates: {
        where: { deletedAt: null },
        include: { phases: { include: { lineItems: true } } },
      },
      invoices: { where: { deletedAt: null } },
      completion: { select: { internalCompleted: true, clientAcknowledged: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const inquiryProjects = allProjects.filter((p) =>
    ["NEW", "BRIEFED", "ESTIMATING", "APPROVED"].includes(p.status),
  );
  const inProgressProjects = allProjects.filter((p) => p.status === "IN_PROGRESS");
  const completionProjects = allProjects.filter((p) => p.status === "DELIVERED");
  const archiveProjects = allProjects.filter((p) => p.status === "CLOSED");

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
  const inquiryStale = inquiryProjects.filter(
    (p) => p.status === "ESTIMATING" && p.updatedAt < staleCutoff,
  );

  const userName = session.user.name?.split(" ")[0] ?? "there";

  const hubs = [
    {
      key: "inquiry" as const,
      label: "Inquiry",
      count: inquiryProjects.length,
      dotColor: "var(--color-s-estimating)",
      activeGlow: "#67D9FF",
    },
    {
      key: "in-progress" as const,
      label: "In Progress",
      count: inProgressProjects.length,
      dotColor: "var(--color-s-in-progress)",
      activeGlow: "#B5BCF8",
    },
    {
      key: "completion" as const,
      label: "Completion",
      count: completionProjects.length,
      dotColor: "var(--color-s-delivered)",
      activeGlow: "#6FE5BC",
    },
    {
      key: "archive" as const,
      label: "Archive",
      count: archiveProjects.length,
      dotColor: "var(--color-s-closed)",
      activeGlow: "#C4C2BC",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] leading-[1.2] mb-1">
            Hi, <span style={{ color: "var(--color-accent)" }}>{userName}</span>
          </h1>
          <p className="font-mono text-[11px] text-ink-500 tracking-[0.02em]">
            // {new Date().toISOString().slice(0, 19).replace("T", " · ")} · 4 hubs active
          </p>
        </div>
      </div>

      <HubTabBar hubs={hubs} active={active} />

      {active === "inquiry" && (
        <HubInquiry projects={inquiryProjects} staleProjects={inquiryStale} />
      )}
      {active === "in-progress" && <HubInProgress projects={inProgressProjects} />}
      {active === "completion" && <HubCompletion projects={completionProjects} />}
      {active === "archive" && <HubArchive projects={archiveProjects} />}
    </div>
  );
}
```

The hub stub files need to accept the additional props passed here. Update Hub 1 stub to accept `staleProjects` too:

```tsx
// src/components/redesign/hubs/hub-1-inquiry.tsx
interface Props {
  projects: any[];
  staleProjects: any[];
}

export function HubInquiry({ projects: _p, staleProjects: _s }: Props) {
  return <div className="text-ink-500 text-sm py-12">Hub 1 · Inquiry — TODO Task 12</div>;
}
```

Use `any[]` in the stubs — the real types are filled in by each hub task.

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000. Header should show "Hi, Yushi" with terracotta accent and a mono timestamp. The hub toggle should render with 4 tabs and clicking tabs should update the URL and the placeholder text below. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(dashboard)/page.tsx' src/components/redesign/hubs/
git commit -m "feat(dashboard): hub URL-param skeleton with stub hub components"
```

---

### Task 12: Hub 1 (Inquiry) full implementation

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/15-hub1-cockpit-v3.html`

This task fills in the canonical hub. Subsequent hubs follow the same pattern.

**Files:**
- Replace: `src/components/redesign/hubs/hub-1-inquiry.tsx`

- [ ] **Step 1: Build the hub**

Open the mockup file at the path above for visual reference. The hub component is a server component that takes pre-fetched projects.

```tsx
// src/components/redesign/hubs/hub-1-inquiry.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { statusTokens } from "@/lib/redesign-tokens";
import { currencySymbol } from "@/lib/currency";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string; version: number; updatedAt: Date }[];
}

interface Props {
  projects: ProjectLite[];
  staleProjects: ProjectLite[];
}

const STALE_DAYS = 30;

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function HubInquiry({ projects, staleProjects }: Props) {
  const briefed = projects.filter((p) => p.status === "BRIEFED");
  const estimating = projects.filter((p) => p.status === "ESTIMATING");
  const sent = estimating.filter((p) => !staleProjects.some((s) => s.id === p.id));
  const approved = projects.filter((p) => p.status === "APPROVED");
  const drafts = projects.filter((p) => p.status === "NEW");

  const pipelineValue = projects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);
  const stalePipelineValue = staleProjects
    .flatMap((p) => p.estimates.filter((e) => e.isApproved))
    .reduce((sum, e) => sum + e.total, 0);
  const oldestStale = staleProjects.reduce(
    (max, p) =>
      Math.max(max, Math.floor((Date.now() - p.updatedAt.getTime()) / 86_400_000)),
    0,
  );

  return (
    <div>
      <Cockpit
        tag="STAGE_01 · INQUIRY"
        title="Inquiry & estimation"
        tagColor="var(--color-s-estimating-fg)"
        context={
          <>
            // <strong className="text-ink-900 font-bold">{projects.length - drafts.length} ACTIVE</strong>
            {drafts.length > 0 ? (
              <Link
                href="/projects?status=NEW"
                className="text-s-estimating-fg tracking-[0.04em] hover:underline"
              >
                // {drafts.length} drafts pending brief →
              </Link>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout
            label="ACTIVE"
            value={pad(projects.length - drafts.length)}
            unit="in this hub"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="BRIEFED"
            value={pad(briefed.length)}
            unit="to estimate"
            dotColor="var(--color-s-briefed)"
          />
          <Readout
            label="SENT"
            value={pad(estimating.length)}
            unit="awaiting client"
            dotColor="var(--color-s-estimating)"
          />
          <Readout
            label="APPROVED"
            value={pad(approved.length)}
            unit="ready to advance"
            dotColor="var(--color-s-approved)"
            muted={approved.length === 0}
          />
          <Readout
            label="STALE"
            value={pad(staleProjects.length)}
            unit={`${STALE_DAYS}d+ no movement`}
            dotColor="var(--color-warn)"
            blink={staleProjects.length > 0}
            warn={staleProjects.length > 0}
          />
        </div>

        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "OLDEST.STALE", value: `${oldestStale}d` },
            { label: "PIPELINE", value: fmtUSD(pipelineValue) },
          ]}
          trailing={
            staleProjects.length > 0 ? (
              <span className="text-warn-fg font-bold tracking-[0.04em]">▶ REVIEW STALE BATCH</span>
            ) : null
          }
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <SubGroup
            label="// ESTIMATION SENT · AWAITING CLIENT"
            count={sent.length}
            color="var(--color-s-estimating-fg)"
            dotColor="var(--color-s-estimating)"
            projects={sent}
            metaFn={(p) => {
              const e = p.estimates.find((x) => x.isApproved) ?? p.estimates[0];
              const days = e ? Math.floor((Date.now() - e.updatedAt.getTime()) / 86_400_000) : 0;
              return {
                main: e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—",
                sub: e ? `v${e.version} · sent ${days}d ago` : "no estimate",
              };
            }}
          />

          <SubGroup
            label="// PROJECT BRIEFED · TO ESTIMATE"
            count={briefed.length}
            color="var(--color-s-briefed-fg)"
            dotColor="var(--color-s-briefed)"
            projects={briefed}
            metaFn={(p) => ({
              main: "no estimate",
              sub: `briefed ${new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            })}
          />

          <SubGroup
            label="// APPROVED · READY FOR NEXT HUB"
            count={approved.length}
            color="var(--color-s-approved-fg)"
            dotColor="var(--color-s-approved)"
            projects={approved}
            emptyText="// STDBY · NO PROJECTS APPROVED YET. ONCE A CLIENT APPROVES, THE PROJECT MOVES TO HUB 2."
            metaFn={(p) => {
              const e = p.estimates.find((x) => x.isApproved);
              return {
                main: e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—",
                sub: "approved",
              };
            }}
          />

          <ToolsArea
            heading="// INQUIRY-STAGE TOOLS"
            tools={[
              { icon: "📐", name: "Estimate templates", desc: "Save reusable phase + line-item templates per service module" },
              { icon: "📤", name: "Send tracker", desc: "See when clients open estimates, which version, how long they spent" },
              { icon: "⏰", name: "Auto follow-up", desc: "Schedule a friendly nudge if the client hasn't responded in 7 days" },
              { icon: "💬", name: "Proposal comments", desc: "Let clients leave inline comments on specific line items" },
              { icon: "🪞", name: "Conversion analytics", desc: "Which estimate sizes / clients / service modules win most often" },
              { icon: "📋", name: "Brief templates", desc: "Standard brief structure per inquiry source (WeChat, email, Lark)" },
            ]}
          />
        </div>

        <div>
          {staleProjects.length > 0 ? (
            <div
              className="rounded-2xl p-4 mb-4 border"
              style={{
                background: "linear-gradient(180deg, #FCEEDC 0%, #FCE5C8 100%)",
                borderColor: "rgba(201, 117, 32, 0.2)",
              }}
            >
              <p className="font-mono text-[10px] font-bold text-warn-fg tracking-[0.06em] uppercase">⚠ STALE BATCH PENDING</p>
              <div className="text-[22px] font-extrabold text-warn-fg tracking-[-0.02em] my-2 rd-tabular leading-none">
                {staleProjects.length}
              </div>
              <p className="text-[11px] text-warn-fg/80 mb-3">
                {fmtUSD(stalePipelineValue)} in pipeline · oldest {oldestStale}d · most won't convert
              </p>
              <button
                type="button"
                className="bg-white text-warn-fg px-3 py-1.5 rounded-md border border-warn font-semibold text-[11px]"
              >
                Review &amp; archive →
              </button>
            </div>
          ) : null}

          <RailStats
            heading="// HUB STATS · LIVE"
            dotColor="var(--color-s-estimating)"
            rows={[
              ["Pipeline value", fmtUSD(pipelineValue)],
              ["Awaiting (active)", `${sent.length} project${sent.length === 1 ? "" : "s"}`],
              ["Stale total", `${staleProjects.length} · ${oldestStale}d max`],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function SubGroup({
  label,
  count,
  color,
  dotColor,
  projects,
  metaFn,
  emptyText,
}: {
  label: string;
  count: number;
  color: string;
  dotColor: string;
  projects: ProjectLite[];
  metaFn: (p: ProjectLite) => { main: string; sub: string };
  emptyText?: string;
}) {
  return (
    <div className="mb-4">
      <p
        className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5"
        style={{ color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {count}</span>
      </p>
      {projects.length === 0 ? (
        <div
          className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
          style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
        >
          {emptyText ?? "// EMPTY"}
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden hover:border-hairline-strong transition-colors">
          {projects.map((p) => {
            const m = metaFn(p);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="grid items-center gap-3.5 px-4 py-3 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr auto 24px" }}
              >
                <span className="w-1 h-8 rounded-full" style={{ background: dotColor }} />
                <span>
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company}</div>
                </span>
                <span className="text-right">
                  <div className="text-xs text-ink-700 font-medium rd-tabular">{m.main}</div>
                  <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">{m.sub}</div>
                </span>
                <span className="text-ink-300 text-sm text-right">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolsArea({ heading, tools }: { heading: string; tools: { icon: string; name: string; desc: string }[] }) {
  return (
    <div
      className="rounded-2xl p-5 mt-5"
      style={{
        background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
        border: "1px dashed var(--color-hairline-strong)",
      }}
    >
      <div className="flex items-center justify-between mb-3.5">
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">{heading}</p>
        <span
          className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
          style={{ background: "var(--color-ink-300)" }}
        >
          UNDER DEVELOPMENT
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {tools.map((t) => (
          <GrayToolCard key={t.name} icon={t.icon} name={t.name} desc={t.desc} />
        ))}
      </div>
    </div>
  );
}

function RailStats({
  heading,
  dotColor,
  rows,
}: {
  heading: string;
  dotColor: string;
  rows: [string, string][];
}) {
  return (
    <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
      <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {heading}
      </p>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs"
        >
          <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{label}</span>
          <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000. With seeded data the Inquiry hub should show ESTIMATING projects under "Awaiting client", real counts in the cockpit readouts, and the stale banner if any project has been in ESTIMATING for >30 days. Click "+ New project" still goes to the existing /projects/new (we keep that flow).

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-1-inquiry.tsx
git commit -m "feat(hub1): full Inquiry hub with cockpit, sub-status groups, tools, rail"
```

---

### Task 13: Hub 2 (In Progress) full implementation

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/16-hub2-in-progress.html`

**Files:**
- Replace: `src/components/redesign/hubs/hub-2-in-progress.tsx`

- [ ] **Step 1: Build the hub**

Same shape as Hub 1 but:
- Cockpit color is `--color-s-in-progress` (indigo)
- Tag is `STAGE_02 · IN PROGRESS`, title `Execution & delivery`
- Readouts: `ACTIVE / RECRUITMENT / FIELDWORK / ANALYSIS / REPORTING` — counts derived from `Project.executionPhase`
- Sub-status groups (4) by execution phase, each with its own phase color
- Each row shows a 4-dot mini phase progress (done dots gray, current dot in phase color)
- Tools: Team management · Vendor directory · Deliverable tracker · Time logging · Vendor invoice review · Phase deadlines (all gray)
- Rail: live hub stats (active value, avg project size, largest in-flight) and a gray "team load" preview card

Reuse the helper components defined in Task 12 (`SubGroup`, `ToolsArea`, `RailStats`) — copy them into a shared file `src/components/redesign/hubs/_helpers.tsx` if they grow, or duplicate per hub for now (acceptable; the plan author can refactor later if it becomes painful).

Implementation pattern (full file follows the same structure as Hub 1):

```tsx
// src/components/redesign/hubs/hub-2-in-progress.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { phaseTokens } from "@/lib/redesign-tokens";
import { currencySymbol } from "@/lib/currency";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  executionPhase: string | null;
  startDate: Date | null;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pad(n: number) { return n.toString().padStart(2, "0"); }

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
        ? Math.max(max, Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000))
        : max,
    0,
  );
  const newest = projects.reduce(
    (min, p) =>
      p.startDate
        ? Math.min(min, Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000))
        : min,
    Number.POSITIVE_INFINITY,
  );

  return (
    <div>
      <Cockpit
        tag="STAGE_02 · IN PROGRESS"
        title="Execution & delivery"
        tagColor="var(--color-s-in-progress-fg)"
        context={
          <>
            // all <strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong> below are actively being executed
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
            { label: "NEWEST.START", value: Number.isFinite(newest) ? `${newest}d ago` : "—" },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {[
            { phase: "RECRUITMENT", projects: recruit, label: "// RECRUITMENT" },
            { phase: "FIELDWORK", projects: field, label: "// FIELDWORK" },
            { phase: "ANALYSIS", projects: analyze, label: "// ANALYSIS" },
            { phase: "REPORTING", projects: report, label: "// REPORTING" },
          ].map((g) => (
            <PhaseGroup key={g.phase} phase={g.phase} label={g.label} projects={g.projects} />
          ))}

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">// IN-PROGRESS TOOLS</p>
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
              // HUB STATS · LIVE
            </p>
            {[
              ["Active value", fmtUSD(activeValue)],
              ["Avg project size", projects.length ? fmtUSD(activeValue / projects.length) : "—"],
              ["Largest in-flight", fmtUSD(Math.max(0, ...projects.flatMap((p) => p.estimates.filter((e) => e.isApproved).map((e) => e.total))))],
            ].map(([l, v]) => (
              <div key={l} className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs">
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

function PhaseGroup({
  phase,
  label,
  projects,
}: {
  phase: string;
  label: string;
  projects: ProjectLite[];
}) {
  const t = phaseTokens(phase);
  const phaseOrder = ["RECRUITMENT", "FIELDWORK", "ANALYSIS", "REPORTING"];
  const currentIdx = phaseOrder.indexOf(phase);

  return (
    <div className="mb-4.5">
      <p
        className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5"
        style={{ color: t.fg }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {projects.length}</span>
      </p>
      {projects.length === 0 ? (
        <div
          className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]"
          style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}
        >
          // STDBY · NO PROJECTS IN {phase}
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
          {projects.map((p) => {
            const days = p.startDate
              ? Math.floor((Date.now() - p.startDate.getTime()) / 86_400_000)
              : null;
            const e = p.estimates.find((x) => x.isApproved);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr 130px auto 24px" }}
              >
                <span className="w-1 h-9 rounded-full" style={{ background: t.dot }} />
                <span>
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company}</div>
                </span>
                <span className="flex gap-1 items-center">
                  {phaseOrder.map((ph, i) => (
                    <span
                      key={ph}
                      className="w-3.5 h-1.5 rounded-full"
                      style={{
                        background:
                          i < currentIdx
                            ? "var(--color-ink-300)"
                            : i === currentIdx
                              ? t.dot
                              : "var(--color-hairline)",
                      }}
                    />
                  ))}
                  <span
                    className="font-mono text-[10px] ml-1.5 tracking-[0.04em] uppercase font-semibold"
                    style={{ color: t.fg }}
                  >
                    {phase.slice(0, 6)}
                  </span>
                </span>
                <span className="text-right">
                  <div className="text-xs text-ink-700 font-medium rd-tabular">
                    {e ? `${currencySymbol(e.currency)}${e.total.toLocaleString()}` : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-ink-400 mt-0.5 tracking-[0.02em]">
                    {days != null ? `started ${days}d ago` : "no start date"}
                  </div>
                </span>
                <span className="text-ink-300 text-sm text-right">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

Update the props in `src/app/(dashboard)/page.tsx` to pass the additional fields to `<HubInProgress>` (already there from Task 11 — projects already include `executionPhase` and `startDate` because Prisma returns all scalar fields by default, so no query change needed).

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000?hub=in-progress. Should show projects with the indigo accent, grouped by execution phase. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-2-in-progress.tsx
git commit -m "feat(hub2): full In Progress hub with phase distribution"
```

---

### Task 14: Hub 3 (Completion) full implementation

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/18-hub3-completion.html`

**Files:**
- Replace: `src/components/redesign/hubs/hub-3-completion.tsx`

- [ ] **Step 1: Build the hub**

Same skeleton as Hubs 1/2 but tuned for completion. Sub-status groups:
1. `// RECONCILE ACTUALS & SIGN-OFF` (status DELIVERED, no invoice yet OR invoice in DRAFT, no completion sign-off yet)
2. `// INVOICE SENT · AWAITING PAYMENT` (status DELIVERED with invoice in SENT/OVERDUE)
3. `// PAID · READY FOR HUB 4` (status DELIVERED with invoice PAID)

Cockpit readouts: `ACTIVE / RECONCILE / AWAITING PAY / PAID·ARCHIVE / VARIANCE`. Variance = sum of (delivered - planned) across all DELIVERED projects' approved estimates. Calculable from `EstimateLineItem.deliveredQuantity` (added 2026-04-27).

Each row needs:
- Variance chip: green for under (`-$420 / -3.3%`), red for over, gray "on plan", neutral "// pending" if `deliveredQuantity` not set
- Invoice status pill: `none` (dashed gray "no invoice yet"), `Draft`, `Sent · due Nd`, `Paid`
- Quick action button(s) per group:
  - Reconcile group: `Confirm actuals` (links to `/projects/[id]?tab=confirm-actuals`) — primary dark
  - Invoice draft: `Send invoice` — primary dark, links to `/invoices/[id]/send`
  - Awaiting payment: `Remind` (gray, toast) + `Mark paid` (green primary)
  - Paid: `Archive →` (primary dark, calls existing PATCH `/api/projects/[id]` with `{ status: "CLOSED" }`)

Tools: Auto-reconciliation · Variance reports · Payment reminders · Bank-feed reconciliation · Invoice templates · Currency conversion (all gray).

```tsx
// src/components/redesign/hubs/hub-3-completion.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";
import { currencySymbol } from "@/lib/currency";

interface InvoiceLite {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: Date | null;
  paidDate: Date | null;
}

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  client: { company: string };
  estimates: {
    id: string;
    isApproved: boolean;
    total: number;
    currency: string;
    phases: { lineItems: { quantity: number; unitPrice: number; deliveredQuantity: number | null }[] }[];
  }[];
  invoices: InvoiceLite[];
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) { return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function pad(n: number) { return n.toString().padStart(2, "0"); }

function projectVariance(p: ProjectLite): { delivered: number; planned: number; delta: number; pct: number; pending: boolean } {
  const approved = p.estimates.find((e) => e.isApproved);
  if (!approved) return { delivered: 0, planned: 0, delta: 0, pct: 0, pending: true };
  let planned = 0;
  let delivered = 0;
  let pending = false;
  for (const phase of approved.phases) {
    for (const li of phase.lineItems) {
      planned += li.quantity * li.unitPrice;
      if (li.deliveredQuantity == null) pending = true;
      delivered += (li.deliveredQuantity ?? li.quantity) * li.unitPrice;
    }
  }
  const delta = delivered - planned;
  const pct = planned ? (delta / planned) * 100 : 0;
  return { delivered, planned, delta, pct, pending };
}

function classify(p: ProjectLite): "reconcile" | "awaiting-pay" | "paid" {
  const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
  const paidInv = p.invoices.find((i) => i.status === "PAID");
  if (paidInv) return "paid";
  if (sentInv) return "awaiting-pay";
  return "reconcile";
}

export function HubCompletion({ projects }: Props) {
  const reconcile = projects.filter((p) => classify(p) === "reconcile");
  const awaitingPay = projects.filter((p) => classify(p) === "awaiting-pay");
  const paid = projects.filter((p) => classify(p) === "paid");

  const allVariance = projects.map(projectVariance).filter((v) => !v.pending);
  const avgVariancePct =
    allVariance.length === 0
      ? 0
      : allVariance.reduce((s, v) => s + v.pct, 0) / allVariance.length;
  const deliveredValue = allVariance.reduce((s, v) => s + v.delivered, 0);
  const toInvoice = projects
    .filter((p) => classify(p) === "reconcile")
    .reduce((s, p) => s + projectVariance(p).delivered, 0);
  const receivable = projects
    .flatMap((p) => p.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE"))
    .reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <Cockpit
        tag="STAGE_03 · COMPLETION"
        title="Reconciliation & final invoice"
        tagColor="var(--color-s-delivered-fg)"
        context={
          <>
            // all <strong className="text-ink-900 font-bold">{projects.length} PROJECTS</strong> below have delivered work
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="ACTIVE" value={pad(projects.length)} unit="in this hub" dotColor="var(--color-s-delivered)" />
          <Readout label="RECONCILE" value={pad(reconcile.length)} unit="actuals · sign-off" dotColor="var(--color-warn)" blink={reconcile.length > 0} muted={reconcile.length === 0} />
          <Readout label="AWAITING PAY" value={pad(awaitingPay.length)} unit="invoice sent" dotColor="#EC4899" muted={awaitingPay.length === 0} />
          <Readout label="PAID · ARCHIVE" value={pad(paid.length)} unit="ready to advance" dotColor="var(--color-s-delivered)" muted={paid.length === 0} />
          <Readout
            label="VARIANCE"
            value={
              <span style={{ color: avgVariancePct < 0 ? "var(--color-var-under)" : "var(--color-ink-900)" }}>
                {avgVariancePct >= 0 ? "+" : ""}
                {avgVariancePct.toFixed(1)}
                <span className="text-[18px] font-semibold">%</span>
              </span>
            }
            unit="avg"
          />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "NOMINAL" },
            { label: "UPDATED", value: new Date().toTimeString().slice(0, 8) },
            { label: "TO.INVOICE", value: fmtUSD(toInvoice) },
            { label: "RECEIVABLE", value: fmtUSD(receivable) },
            { label: "DELIVERED.VALUE", value: fmtUSD(deliveredValue) },
            { label: "AVG.VARIANCE", value: `${avgVariancePct >= 0 ? "+" : ""}${avgVariancePct.toFixed(1)}%`, under: avgVariancePct < 0 },
          ]}
        />
      </Cockpit>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          <CompletionGroup label="// RECONCILE ACTUALS & SIGN-OFF" color="var(--color-warn-fg)" dotColor="var(--color-warn)" projects={reconcile} variant="reconcile" />
          <CompletionGroup label="// INVOICE SENT · AWAITING PAYMENT" color="#9F1239" dotColor="#EC4899" projects={awaitingPay} variant="awaiting" />
          <CompletionGroup label="// PAID · READY FOR HUB 4" color="var(--color-s-delivered-fg)" dotColor="var(--color-s-delivered)" projects={paid} variant="paid" />

          <div
            className="rounded-2xl p-5 mt-5"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">// COMPLETION-STAGE TOOLS</p>
              <span className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase" style={{ background: "var(--color-ink-300)" }}>
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
              // HUB STATS · LIVE
            </p>
            {[
              ["Delivered value", fmtUSD(deliveredValue)],
              ["Pending invoice", fmtUSD(toInvoice)],
              ["Receivable (unpaid)", fmtUSD(receivable)],
              ["Avg variance", `${avgVariancePct >= 0 ? "+" : ""}${avgVariancePct.toFixed(1)}%`],
            ].map(([l, v]) => (
              <div key={l} className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs">
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

function CompletionGroup({
  label,
  color,
  dotColor,
  projects,
  variant,
}: {
  label: string;
  color: string;
  dotColor: string;
  projects: ProjectLite[];
  variant: "reconcile" | "awaiting" | "paid";
}) {
  return (
    <div className="mb-4.5">
      <p className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase mb-2 ml-1 flex items-center gap-1.5" style={{ color }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        {label}
        <span className="text-ink-300 ml-1 font-semibold">· {projects.length}</span>
      </p>
      {projects.length === 0 ? (
        <div className="rounded-xl p-4.5 text-center font-mono text-[11px] text-ink-400 tracking-[0.04em]" style={{ background: "#FAFAF6", border: "1px dashed var(--color-hairline-strong)" }}>
          // STDBY
        </div>
      ) : (
        <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
          {projects.map((p) => {
            const v = projectVariance(p);
            const draftInv = p.invoices.find((i) => i.status === "DRAFT");
            const sentInv = p.invoices.find((i) => i.status === "SENT" || i.status === "OVERDUE");
            const paidInv = p.invoices.find((i) => i.status === "PAID");

            return (
              <div
                key={p.id}
                className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                style={{ gridTemplateColumns: "4px 1fr auto auto auto 24px" }}
              >
                <span className="w-1 h-9 rounded-full" style={{ background: dotColor }} />
                <Link href={`/projects/${p.id}`} className="block">
                  <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                  <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                  <div className="text-[11px] text-ink-500">{p.client.company} · delivered</div>
                </Link>
                <VarianceChip variance={v} />
                <InvoicePill invoice={draftInv ?? sentInv ?? paidInv} />
                <Actions variant={variant} project={p} draftInv={draftInv} sentInv={sentInv} paidInv={paidInv} />
                <span className="text-ink-300 text-sm text-right">›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VarianceChip({ variance: v }: { variance: ReturnType<typeof projectVariance> }) {
  if (v.pending) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ border: "1px dashed var(--color-ink-300)", color: "var(--color-ink-400)" }}>
        // pending
      </span>
    );
  }
  if (Math.abs(v.delta) < 1) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ background: "var(--color-canvas-cool)", color: "var(--color-ink-500)" }}>on plan</span>;
  }
  const isUnder = v.delta < 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]"
      style={{
        background: isUnder ? "rgba(5, 150, 105, 0.10)" : "rgba(220, 38, 38, 0.10)",
        color: isUnder ? "var(--color-var-under)" : "var(--color-var-over)",
      }}
    >
      {isUnder ? "" : "+"}${Math.round(Math.abs(v.delta)).toLocaleString()} / {v.pct.toFixed(1)}%
    </span>
  );
}

function InvoicePill({ invoice }: { invoice?: InvoiceLite }) {
  if (!invoice) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold" style={{ background: "var(--color-canvas-cool)", color: "var(--color-ink-400)", border: "1px dashed var(--color-ink-300)" }}>
        no invoice yet
      </span>
    );
  }
  const map: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
    DRAFT:   { bg: "#EFF1F5",                fg: "#475569",                  dot: "#94A3B8", label: "Draft" },
    SENT:    { bg: "#FCE7F3",                fg: "#9F1239",                  dot: "#EC4899", label: "Sent" },
    OVERDUE: { bg: "var(--color-warn-bg)",   fg: "var(--color-warn-fg)",     dot: "var(--color-warn)", label: "Overdue" },
    PAID:    { bg: "var(--color-s-delivered-bg)", fg: "var(--color-s-delivered-fg)", dot: "var(--color-s-delivered)", label: "Paid" },
  };
  const t = map[invoice.status] ?? map.DRAFT;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: t.bg, color: t.fg }}>
      <span className="w-1 h-1 rounded-full" style={{ background: t.dot }} />
      {t.label}
    </span>
  );
}

function Actions({
  variant,
  project,
  draftInv,
  sentInv,
}: {
  variant: "reconcile" | "awaiting" | "paid";
  project: ProjectLite;
  draftInv?: InvoiceLite;
  sentInv?: InvoiceLite;
  paidInv?: InvoiceLite;
}) {
  if (variant === "reconcile" && !draftInv) {
    return (
      <Link
        href={`/projects/${project.id}?tab=confirm-actuals`}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Confirm actuals
      </Link>
    );
  }
  if (variant === "reconcile" && draftInv) {
    return (
      <Link
        href={`/invoices/${draftInv.id}/send`}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Send invoice
      </Link>
    );
  }
  if (variant === "awaiting" && sentInv) {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] border border-hairline text-ink-700"
        >
          Remind
        </button>
        <button
          type="button"
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
          style={{ background: "var(--color-s-delivered)" }}
        >
          Mark paid
        </button>
      </div>
    );
  }
  if (variant === "paid") {
    return (
      <button
        type="button"
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--color-ink-900)" }}
      >
        Archive →
      </button>
    );
  }
  return null;
}
```

NOTE: The `Mark paid`, `Remind`, and `Archive →` buttons in this hub need wiring to the existing endpoints in a follow-up polish task. For now they are visual only — the dashboard works for navigation; actions on individual rows route through clicking the row itself.

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000?hub=completion. Should render whatever projects are currently in DELIVERED state grouped by their invoice status. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-3-completion.tsx
git commit -m "feat(hub3): full Completion hub with variance chips and per-row actions"
```

---

### Task 15: Hub 4 (Archive) full implementation

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/19-hub4-archive.html`

**Files:**
- Replace: `src/components/redesign/hubs/hub-4-archive.tsx`

- [ ] **Step 1: Build the hub**

The archive hub leans into a knowledge-library framing:
- Cockpit readouts: `TOTAL · LAST.30D · LAST.90D · REVENUE · AVG.PROJECT`
- Status row: `STATUS: ARCHIVE · UPDATED · TOP.CLIENT · UNIQUE.CLIENTS · MOST.RECENT · TOP.MODULE`
- Search & filter strip with full-width search input + filter chips (Year ▾ / Client ▾ / Service ▾ / Recent first) — these are visual only in this task; functional filtering can be added later
- Body: archived projects grouped by year (`2026 · 11 archived · $148.2K`), each row shows project + client + archive date + service module dots + value + feedback chip (`★ 4.5 · feedback collected` or `// no feedback yet` for projects without that future field — show all as `// no feedback yet` for now)
- Knowledge insight cards (gray): Project knowledge tagging · Case studies · Methodology library · Annual review
- Tools: Feedback request · Internal learnings · Knowledge search · Reusable insights · Client retention · Capability heatmap (all gray)
- Right rail: HUB STATS · TOP CLIENTS leaderboard · SERVICE MIX (horizontal stacked bar from `Inquiry.serviceModules`)

```tsx
// src/components/redesign/hubs/hub-4-archive.tsx
import Link from "next/link";
import { Cockpit, Readout, StatusRow } from "@/components/redesign/cockpit";
import { GrayToolCard } from "@/components/redesign/gray-tool-card";

interface ProjectLite {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  client: { company: string };
  estimates: { isApproved: boolean; total: number; currency: string }[];
}

interface Props { projects: ProjectLite[]; }

function fmtUSD(n: number) { return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }
function pad(n: number) { return n.toString().padStart(2, "0"); }

export function HubArchive({ projects }: Props) {
  const allTimeRevenue = projects.flatMap((p) => p.estimates.filter((e) => e.isApproved)).reduce((s, e) => s + e.total, 0);
  const last30 = projects.filter((p) => Date.now() - p.updatedAt.getTime() < 30 * 86_400_000);
  const last90 = projects.filter((p) => Date.now() - p.updatedAt.getTime() < 90 * 86_400_000);
  const avgProject = projects.length ? allTimeRevenue / projects.length : 0;

  // Group by year
  const byYear = new Map<number, ProjectLite[]>();
  for (const p of projects) {
    const y = p.updatedAt.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(p);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  // Top clients
  const byClient = new Map<string, { count: number; revenue: number }>();
  for (const p of projects) {
    const c = p.client.company;
    if (!byClient.has(c)) byClient.set(c, { count: 0, revenue: 0 });
    const r = byClient.get(c)!;
    r.count += 1;
    r.revenue += p.estimates.filter((e) => e.isApproved).reduce((s, e) => s + e.total, 0);
  }
  const topClients = Array.from(byClient.entries())
    .map(([name, r]) => ({ name, ...r }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div>
      <Cockpit
        tag="STAGE_04 · ARCHIVE"
        title="Project knowledge library"
        tagColor="var(--color-s-closed-fg)"
        context={
          <>
            // <strong className="text-ink-900 font-bold">{projects.length} ARCHIVED</strong> · paid &amp; closed · browse to learn
          </>
        }
      >
        <div className="grid grid-cols-5 gap-0 items-end">
          <Readout label="TOTAL" value={pad(projects.length)} unit="closed projects" dotColor="var(--color-s-closed)" />
          <Readout label="LAST.30D" value={pad(last30.length)} unit="closed recently" muted={last30.length === 0} />
          <Readout label="LAST.90D" value={pad(last90.length)} unit="closed this quarter" muted={last90.length === 0} />
          <Readout
            label="REVENUE"
            value={
              <>
                {Math.round(allTimeRevenue / 1000)}<span className="text-[18px] font-semibold">K</span>
              </>
            }
            unit="all-time delivered"
          />
          <Readout
            label="AVG.PROJECT"
            value={
              <>
                {(avgProject / 1000).toFixed(1)}<span className="text-[18px] font-semibold">K</span>
              </>
            }
            unit="median size"
          />
        </div>
        <StatusRow
          cells={[
            { label: "STATUS", value: "ARCHIVE" },
            { label: "UNIQUE.CLIENTS", value: byClient.size.toString() },
            { label: "MOST.RECENT", value: projects[0] ? `${Math.floor((Date.now() - projects[0].updatedAt.getTime()) / 86_400_000)}d ago` : "—" },
            { label: "TOP.CLIENT", value: topClients[0]?.name ?? "—" },
          ]}
        />
      </Cockpit>

      {/* Search strip — visual only for now */}
      <div className="flex gap-2 mb-5 items-center flex-wrap">
        <input
          className="flex-1 min-w-[280px] px-3.5 py-2.5 pl-9 bg-card-rd border border-hairline rounded-md text-[13px]"
          placeholder="Search archived projects · client · service module · year"
          style={{ boxShadow: "0 1px 2px rgba(15,23,41,0.04)" }}
        />
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Year ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Client ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md bg-card-rd border border-hairline text-xs font-semibold text-ink-700">Service ▾</button>
        <button type="button" className="px-3 py-1.5 rounded-md text-xs font-semibold text-white" style={{ background: "var(--color-ink-900)" }}>Recent first</button>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        <div>
          {years.map((y) => {
            const yearProjects = byYear.get(y)!;
            const yearRevenue = yearProjects.flatMap((p) => p.estimates.filter((e) => e.isApproved)).reduce((s, e) => s + e.total, 0);
            return (
              <div key={y} className="mb-6">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span className="font-mono text-lg font-bold text-ink-700 tracking-[-0.01em]">{y}</span>
                  <span className="font-mono text-[11px] text-ink-400 tracking-[0.02em]">// {yearProjects.length} archived · {fmtUSD(yearRevenue)}</span>
                  <span className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-card-rd border border-hairline rounded-xl shadow-sm overflow-hidden">
                  {yearProjects.map((p) => {
                    const e = p.estimates.find((x) => x.isApproved);
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="grid items-center gap-3.5 px-4 py-3.5 border-b border-hairline last:border-b-0 hover:bg-[#FCFAF6] transition-colors text-xs"
                        style={{ gridTemplateColumns: "4px 1fr auto auto 24px" }}
                      >
                        <span className="w-1 h-9 rounded-full" style={{ background: "var(--color-s-closed)" }} />
                        <span>
                          <span className="font-mono text-[10px] text-ink-300 tracking-[0.04em]">{p.projectNumber}</span>
                          <div className="text-[13px] font-medium text-ink-900 mt-0.5 tracking-[-0.005em]">{p.title}</div>
                          <div className="text-[11px] text-ink-500 mt-0.5">
                            {p.client.company} · archived {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.02em]" style={{ border: "1px dashed var(--color-ink-300)", color: "var(--color-ink-400)" }}>
                          // no feedback yet
                        </span>
                        <span className="text-right">
                          <div className="text-[13px] font-semibold text-ink-900 rd-tabular tracking-[-0.01em]">{e ? fmtUSD(e.total) : "—"}</div>
                        </span>
                        <span className="text-ink-300 text-sm text-right">›</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Knowledge insight cards (gray) */}
          <div className="grid grid-cols-2 gap-2.5 mt-6">
            <GrayToolCard icon="🏷" name="Project knowledge tagging" desc="Tag past projects with methodologies, learnings, and reusable insights" />
            <GrayToolCard icon="📑" name="Case study generator" desc="Auto-draft internal case studies from completed projects" />
            <GrayToolCard icon="📚" name="Methodology library" desc="Reusable discussion guides, screeners, and stim materials" />
            <GrayToolCard icon="📈" name="Annual review" desc="Year-end snapshot of revenue, growth, and capability gaps" />
          </div>

          <div
            className="rounded-2xl p-5 mt-4"
            style={{
              background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
              border: "1px dashed var(--color-hairline-strong)",
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">// ARCHIVE-STAGE TOOLS</p>
              <span className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase" style={{ background: "var(--color-ink-300)" }}>UNDER DEVELOPMENT</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <GrayToolCard icon="💌" name="Feedback request" desc="Email client a short survey when project archives" />
              <GrayToolCard icon="📓" name="Internal learnings" desc="Capture what worked, what didn't, what to do differently" />
              <GrayToolCard icon="🔍" name="Knowledge search" desc="Search across project briefs, deliverables, and notes" />
              <GrayToolCard icon="🪞" name="Reusable insights" desc="Pull recurring quotes and findings into a tagged library" />
              <GrayToolCard icon="🤝" name="Client retention" desc="See repeat-engagement clients; flag dormant ones" />
              <GrayToolCard icon="🌡" name="Capability heatmap" desc="Spot growth and gaps in your service mix over time" />
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-s-closed)" }} />
              // HUB STATS · LIVE
            </p>
            {[
              ["All-time revenue", fmtUSD(allTimeRevenue)],
              ["Median project size", fmtUSD(avgProject)],
              ["Largest archived", projects.length ? fmtUSD(Math.max(0, ...projects.flatMap((p) => p.estimates.filter((e) => e.isApproved).map((e) => e.total)))) : "—"],
              ["Repeat clients", `${Array.from(byClient.values()).filter((r) => r.count > 1).length} of ${byClient.size}`],
            ].map(([l, v]) => (
              <div key={l} className="grid grid-cols-[1fr_auto] items-baseline py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs">
                <span className="font-mono text-[10px] text-ink-500 tracking-[0.04em] uppercase">{l}</span>
                <span className="text-sm font-bold text-ink-900 rd-tabular tracking-[-0.01em]">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-card-rd border border-hairline rounded-2xl p-4.5 mb-4 shadow-sm">
            <p className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500 m-0 mb-3.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
              // TOP CLIENTS · ALL-TIME
            </p>
            {topClients.map((c, i) => (
              <div key={c.name} className="grid items-center gap-2.5 py-2 border-b border-dashed border-hairline last:border-b-0 first:pt-0 last:pb-0 text-xs" style={{ gridTemplateColumns: "24px 1fr auto auto" }}>
                <span className="font-mono text-[11px] font-bold text-ink-300 tracking-[0.04em]">{(i + 1).toString().padStart(2, "0")}</span>
                <span className="text-[13px] text-ink-900 font-medium">{c.name}</span>
                <span className="font-mono text-[11px] text-ink-500">{c.count} proj</span>
                <span className="font-mono text-xs font-semibold text-ink-900 rd-tabular">{fmtUSD(c.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open localhost:3000?hub=archive. Should show closed projects grouped by year. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/hubs/hub-4-archive.tsx
git commit -m "feat(hub4): full Archive hub with year groups, top clients, knowledge tools"
```

---

## Phase 5 — Project detail page restyle

### Task 16: Project detail header, stages, and tabs

Restyle the project detail page (`src/app/(dashboard)/projects/[id]/page.tsx`) to use the new visual treatment described in spec §7.1. Tab content stays as it is in this task — the rewrite of individual tab contents follows in Tasks 17–20.

Reference mockups: any of the project-detail mockups (e.g., `08-stage1-inquiry.html`, `17-stage2-execution.html`, `20-confirm-actuals.html`) — they share the same header/stepper/tabs.

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`
- Modify: `src/components/projects/project-status-stepper.tsx`
- Modify: `src/components/projects/project-hub-tabs.tsx`

- [ ] **Step 1: Restyle the page header**

In `src/app/(dashboard)/projects/[id]/page.tsx`, find the existing header block (around the `<div className="bg-white border rounded-xl p-6 …">` block) and replace it with the simpler treatment:

```tsx
{/* Crumbs */}
<div className="font-mono text-[11px] text-ink-400 mb-3 tracking-[0.02em]">
  <Link href="/projects" className="text-ink-400 hover:text-ink-700 no-underline">Projects</Link>
  <span className="mx-1.5 text-ink-300">›</span>
  <Link href={`/clients/${project.client.id}`} className="text-ink-400 hover:text-ink-700 no-underline">{project.client.company}</Link>
  <span className="mx-1.5 text-ink-300">›</span>
  <span className="text-ink-700 font-semibold">{project.projectNumber}</span>
</div>

<div className="flex items-start justify-between gap-6 flex-wrap mb-5">
  <div>
    <div className="flex items-center gap-2.5 mb-1">
      <span className="font-mono text-[11px] font-semibold text-ink-300 tracking-[0.04em]">
        {project.projectNumber}
      </span>
      <StatusPill status={project.status} />
    </div>
    <h1 className="text-2xl font-bold tracking-[-0.025em] mb-1.5">{project.title}</h1>
    <p className="text-[13px] text-ink-500">
      {project.client.company}
      {project.startDate ? ` · started ${new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
      {project.assignedTo ? ` · ${project.assignedTo.name} lead` : ""}
      {approvedTotal > 0 ? ` · $${approvedTotal.toLocaleString()} approved` : ""}
    </p>
  </div>
  {/* keep any existing head action buttons */}
</div>
```

Add `import { StatusPill } from "@/components/redesign/status-pill";` at the top.

- [ ] **Step 2: Replace the project status stepper with the 4-stage card row**

The existing 7-step stepper (added during the 2026-04-27 redesign) is replaced with a denser 4-card row representing the project lifecycle stages.

Edit `src/components/projects/project-status-stepper.tsx`. Keep the existing `ProjectStatusStepperProps` interface unchanged (so callers don't need to update). Replace the render output entirely:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  currentStatus: string;
  context: {
    hasInquiry: boolean;
    estimateCount: number;
    approvedEstimateCount: number;
    invoiceCount: number;
    hasUninvoicedApproved: boolean;
    updatedAt: string;
    startDate: string | null;
    contactEmail: string | null;
    contactName: string | null;
  };
}

const STAGES = [
  { key: "stage1", label: "1 · Inquiry", desc: "Build estimate, get approval", statuses: ["NEW", "BRIEFED", "ESTIMATING", "APPROVED"], color: "var(--color-s-estimating)", fg: "var(--color-s-estimating-fg)" },
  { key: "stage2", label: "2 · In Progress", desc: "Coordinate team & deliverables", statuses: ["IN_PROGRESS"], color: "var(--color-s-in-progress)", fg: "var(--color-s-in-progress-fg)" },
  { key: "stage3", label: "3 · Completion", desc: "Reconcile actuals · invoice", statuses: ["DELIVERED"], color: "var(--color-s-delivered)", fg: "var(--color-s-delivered-fg)" },
  { key: "stage4", label: "4 · Archive", desc: "After payment received", statuses: ["CLOSED"], color: "var(--color-s-closed)", fg: "var(--color-s-closed-fg)" },
];

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.statuses.includes(status));
}

export function ProjectStatusStepper({ currentStatus, context }: Props) {
  const idx = stageIndex(currentStatus);
  return (
    <div className="grid grid-cols-4 gap-2.5 mb-5">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div
            key={s.key}
            className={cn(
              "rounded-[10px] px-3.5 py-3 border bg-card-rd shadow-sm",
              done && "bg-gradient-to-b from-[#FCFAF6] to-white",
              active && "border-current",
            )}
            style={
              active
                ? { borderColor: s.color, boxShadow: `0 6px 18px -8px ${s.color}50` }
                : { borderColor: "var(--color-hairline)" }
            }
          >
            <div
              className="h-[3px] rounded-full mb-2.5"
              style={{
                background: done ? s.color : active ? s.color : "var(--color-hairline)",
              }}
            />
            <div
              className={cn(
                "font-mono text-[10px] font-bold tracking-[0.06em] uppercase mb-0.5",
              )}
              style={{ color: done ? s.color : active ? s.fg : "var(--color-ink-400)" }}
            >
              {s.label}
            </div>
            <div className={cn("text-[11px]", active ? "text-ink-700" : "text-ink-400")}>
              {s.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

The component is rendered as an info row (no longer interactive). The previous status-change behavior moves to a small dropdown on the project header (out of scope for this task; can be added later as a polish item).

- [ ] **Step 3: Restyle project hub tabs**

Edit `src/components/projects/project-hub-tabs.tsx`. Replace the visual style with underline tabs:

```tsx
// keep the existing interface (value/label/content tabs prop, defaultTab string, URL sync)
// just change the rendered tab buttons to:

<div className="flex gap-0.5 border-b border-hairline mb-6">
  {tabs.map((t) => (
    <button
      key={t.value}
      onClick={() => setActive(t.value)}
      className={cn(
        "px-4 py-2.5 text-[13px] font-medium text-ink-500 border-b-2 border-transparent -mb-px hover:text-ink-900 transition-colors",
        active === t.value && "text-ink-900 border-ink-900 font-semibold",
      )}
    >
      {t.label}
    </button>
  ))}
</div>
{tabs.find((t) => t.value === active)?.content}
```

Preserve any URL-param syncing the existing component already has.

- [ ] **Step 4: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open `localhost:3000/projects/<some-project-id>`. Header should show breadcrumbs, the 4-stage card row, and underline tabs. The active stage card has a colored border + soft glow. Tab content still renders existing components (gets restyled in next tasks).

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(dashboard)/projects/[id]/page.tsx' src/components/projects/project-status-stepper.tsx src/components/projects/project-hub-tabs.tsx
git commit -m "feat(project-hub): redesigned header, 4-stage stepper, underline tabs"
```

---

### Task 17: Stage 1 detail — Estimate as document

When a project is in Stage 1 (NEW/BRIEFED/ESTIMATING/APPROVED), the default tab is `Estimates` and the visual emphasis is the estimate document with a sticky "Send" CTA on the right.

The existing Estimates tab renders `<EstimateBuilder>` — we don't replace that here. We add a new "Document preview" mode toggle so users can view the estimate as the client would see it.

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx` — for Stage 1 projects, default the tab to "estimates" and add a small reference rail on the Overview tab pointing to "Send estimate to client" (the existing approve / RMB-duplicate buttons in `EstimateApproveButton` etc. stay as-is)

For this task, keep the visual treatment minimal: just default the active tab to `estimates` when the project status is in `["NEW", "BRIEFED", "ESTIMATING"]`.

- [ ] **Step 1: Default tab by stage**

In `src/app/(dashboard)/projects/[id]/page.tsx`, find the call to `<ProjectHubTabs defaultTab="overview" tabs={…}>` and change it to default by stage:

```tsx
const stage1 = ["NEW", "BRIEFED", "ESTIMATING", "APPROVED"].includes(project.status);
const stage3 = project.status === "DELIVERED";
const defaultTab =
  stage3 ? "completion"
  : stage1 ? "estimates"
  : "overview";

<ProjectHubTabs defaultTab={defaultTab} tabs={[...]} />
```

(`completion` here is the existing tab key — Task 19 renames it.)

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open the seed project. If it's NEW/BRIEFED/ESTIMATING/APPROVED, the Estimates tab should be active by default. If DELIVERED, the Completion tab is active.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(dashboard)/projects/[id]/page.tsx'
git commit -m "feat(project-hub): default tab by lifecycle stage"
```

NOTE: The full "estimate as document" hero with Send CTA, version history, and notes/activity feed (described in spec §7.2 and reference mockup `08-stage1-inquiry.html`) is a larger redesign of the existing `<EstimateBuilder>` component and is **deferred** to a follow-up task in a future iteration. This redesign focuses on the dashboard-level changes; per-tab content stays functional.

---

### Task 18: Stage 2 detail — Execution tab placeholder

The Execution tab currently has minimal content (a simple "Execution Phase" selector + status text). For the redesign, restyle that area to match the new visual treatment and add a gray placeholder card for future deliverable management. Reference mockup: `17-stage2-execution.html`.

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Find the existing Execution tab rendering**

```bash
grep -n "Execution\|executionPhase" 'src/app/(dashboard)/projects/[id]/page.tsx' | head -20
```

The existing tab is keyed by `value: "execution"`. Find its `content` definition.

- [ ] **Step 2: Replace its content**

Replace the existing `executionTab` (or however it's named) JSX with:

```tsx
const executionTab = (
  <div className="space-y-4">
    {/* Existing phase selector — keep this */}
    {/* (preserve the existing component or controls that set Project.executionPhase) */}

    {/* Gray placeholder for future deliverable management */}
    <div
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
        border: "1px dashed var(--color-hairline-strong)",
      }}
    >
      <div className="flex items-center justify-between mb-3.5">
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">
          // DELIVERABLES & TEAM TRACKING
        </p>
        <span
          className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
          style={{ background: "var(--color-ink-300)" }}
        >
          UNDER DEVELOPMENT
        </span>
      </div>
      <p className="text-[12px] text-ink-500 mb-3 max-w-prose">
        Auto-generate deliverables from the approved estimate's line items. Assign internal team
        members or external vendors to each deliverable. Track per-line completion through
        Recruitment → Fieldwork → Analysis → Reporting. The summary feeds into Confirm Actuals on
        Stage 3.
      </p>
      <button
        type="button"
        onClick={() => import("@/components/redesign/under-dev-toast").then(({ showUnderDevToast }) => showUnderDevToast("Deliverable management"))}
        className="px-3 py-1.5 rounded-md text-xs font-semibold border border-dashed border-ink-300 text-ink-700 cursor-pointer hover:border-ink-700 hover:border-solid"
      >
        Generate deliverables from estimate
      </button>
    </div>
  </div>
);
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open the seed project, navigate to the Execution tab. Should show the existing phase selector PLUS the gray placeholder card. Click the generate button → toast appears.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(dashboard)/projects/[id]/page.tsx'
git commit -m "feat(project-hub): execution tab gray placeholder for deliverable mgmt"
```

---

## Phase 6 — Confirm Actuals + Send Invoice

### Task 19: Replace `DeliverySignoffTab` with `ConfirmActualsTab`

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/20-confirm-actuals.html`

The existing `delivery-signoff-tab.tsx` (added during 2026-04-27 redesign) becomes the new Confirm Actuals page. Same data flows (`PATCH /api/projects/[id]/delivery` for actuals, `PATCH /api/projects/[id]/completion` for sign-off, `POST /api/projects/[id]/invoices` for the draft-invoice generation). Different UX: per-line variance reconciliation, "Mark all as planned" bulk action, sticky action footer with the `Confirm & generate draft invoice` CTA.

**Files:**
- Replace: `src/components/projects/delivery-signoff-tab.tsx` — full rewrite
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx` — rename the tab key/label

- [ ] **Step 1: Rewrite the component**

Open the mockup file at the path above and the existing `delivery-signoff-tab.tsx`. The data props the existing component receives (`estimates`, `initialCompletion`, `billingSummary`, `hasInvoices`, `projectStatus`, `projectId`) cover everything we need. Keep the same prop interface; replace the render output entirely with the design from the mockup.

Key visual changes vs. the existing component:
- Section A's actuals editor becomes a single dominant area (no longer one of three sections)
- Each line item is now in a row with: planned (qty × price), delivered (editable input + computed total), variance chip
- Variance chips: under-budget green, over-budget red, on-plan gray, "// pending" dashed
- Phase blocks have colored phase tags
- Totals card with heavy ink-900 border at the bottom
- Notes textarea + sign-off checkboxes + sign-off-by name input below totals
- Sticky footer: running summary (`3 of 7 lines confirmed · -$120 variance`) + buttons: Save draft · Save & continue later · `✓ Confirm & generate draft invoice` (primary emerald)

The component should expose a callback or use router.refresh() to navigate to `/invoices/[newInvoiceId]/send` after the draft invoice is generated. The `POST /api/projects/[id]/invoices` endpoint returns the new invoice — use its `id` to redirect:

```tsx
const handleConfirm = async () => {
  // First save delivered quantities via PATCH /delivery (same as existing component)
  await fetch(`/api/projects/${projectId}/delivery`, { method: "PATCH", body: JSON.stringify({ lines }), headers: { "Content-Type": "application/json" } });

  // Save sign-off if any
  if (signoffChanged) {
    await fetch(`/api/projects/${projectId}/completion`, { method: "PATCH", body: JSON.stringify(signoff), headers: { "Content-Type": "application/json" } });
  }

  // Generate draft invoice from confirmed actuals
  const approved = estimates.find((e) => e.id === selectedEstimateId);
  if (!approved) return;
  const slice = approved.lines
    .filter((l) => edits[approved.id]?.[l.id] != null && (edits[approved.id]![l.id] ?? 0) > 0)
    .map((l) => ({ estimateLineItemId: l.id, quantity: edits[approved.id]![l.id]! }));

  const res = await fetch(`/api/projects/${projectId}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estimateId: approved.id, mode: "SLICE", lines: slice }),
  });
  if (!res.ok) {
    toast.error("Failed to generate invoice");
    return;
  }
  const inv = await res.json();
  router.push(`/invoices/${inv.id}/send`);
};
```

The full component rewrite is substantial (~400 lines). Reference the mockup HTML for visual fidelity; the data wiring uses the existing endpoints.

- [ ] **Step 2: Rename the tab in the project hub**

In `src/app/(dashboard)/projects/[id]/page.tsx`, find the tabs array. Change the `completion` tab entry's label:

```tsx
{ value: "completion", label: "Confirm Actuals", content: completionTab },
```

(Keep `value: "completion"` so existing URL bookmarks `?tab=completion` still resolve.)

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open a DELIVERED project. The Confirm Actuals tab should be active by default (Task 17 made it default for delivered status). Edit a delivered quantity, see variance chip update. Click Confirm & generate → should POST and navigate to `/invoices/[newId]/send`. The Send Invoice page may 404 — that's fine, we build it in Task 20.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/delivery-signoff-tab.tsx 'src/app/(dashboard)/projects/[id]/page.tsx'
git commit -m "feat(redesign): Confirm Actuals page replaces Delivery & Sign-off"
```

---

### Task 20: Send Invoice page

Reference mockup: `.superpowers/brainstorm/53352-1777404878/content/21-send-invoice.html`

A new full-page route at `/invoices/[id]/send` that shows the invoice PDF preview on the left and a sticky send panel on the right.

**Files:**
- Create: `src/app/(dashboard)/invoices/[id]/send/page.tsx`
- Create: `src/components/invoices/send-invoice-page.tsx` (client component)

- [ ] **Step 1: Create the route**

```tsx
// src/app/(dashboard)/invoices/[id]/send/page.tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SendInvoicePage } from "@/components/invoices/send-invoice-page";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          client: true,
          primaryContact: { select: { name: true, email: true } },
        },
      },
      lineItems: { orderBy: { sortOrder: "asc" } },
      estimate: true,
    },
  });
  if (!invoice) notFound();

  return <SendInvoicePage invoice={invoice as any} />;
}
```

- [ ] **Step 2: Create the page component**

Build out `send-invoice-page.tsx` following the mockup. Structure:

```tsx
// src/components/invoices/send-invoice-page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/components/redesign/status-pill";
import { showUnderDevToast } from "@/components/redesign/under-dev-toast";
import { currencySymbol } from "@/lib/currency";

interface Props {
  invoice: any; /* full Prisma payload */
}

export function SendInvoicePage({ invoice }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(
    `UBInsights · Invoice ${invoice.invoiceNumber} · ${invoice.project.title}`,
  );
  const [message, setMessage] = useState(
    `Hi ${invoice.project.primaryContact?.name?.split(" ")[0] ?? "there"},\n\nThanks again for partnering with us on the ${invoice.project.title.toLowerCase()} study. Attached is the final invoice for ${invoice.invoiceNumber}, total ${currencySymbol(invoice.currency)}${invoice.total.toLocaleString()}.\n\nLet me know if you have any questions on the line items.\n\nBest`,
  );
  const [submitting, setSubmitting] = useState(false);

  const markSent = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Invoice marked as sent");
      router.push(`/?hub=completion`);
    } catch {
      toast.error("Failed to mark sent");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdfAndMarkSent = async () => {
    // Trigger the PDF download (existing /api/invoices/[id]/pdf endpoint)
    window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
    await markSent();
  };

  // Layout: crumbs, project header, stage stepper, tabs, banner, two-column body.
  // Render the invoice document on the left following the mockup's table structure.
  // Render the send panel on the right with subject/message/method buttons.
  // (Detailed JSX follows the mockup; key bits below.)

  return (
    <div>
      {/* Crumbs */}
      <div className="font-mono text-[11px] text-ink-400 mb-3 tracking-[0.02em]">
        <Link href="/projects" className="text-ink-400 no-underline">Projects</Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <Link href={`/projects/${invoice.project.id}`} className="text-ink-400 no-underline">{invoice.project.client.company}</Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <Link href={`/projects/${invoice.project.id}`} className="text-ink-400 no-underline">{invoice.project.projectNumber}</Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700 font-semibold">Send invoice</span>
      </div>

      {/* Banner */}
      <div className="mb-5 px-4 py-3 rounded-[10px] flex items-center gap-3" style={{ background: "linear-gradient(180deg, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0.04) 100%)", border: "1px solid var(--color-s-delivered)" }}>
        <div className="w-7 h-7 rounded-full bg-s-delivered text-white flex items-center justify-center text-[13px] shrink-0">⚡</div>
        <div>
          <div className="text-[13px] text-ink-700 leading-[1.4]"><strong className="text-ink-900 font-semibold">Draft invoice</strong> · {invoice.lineItems.length} line items · ready to send</div>
          <div className="font-mono text-[11px] text-ink-500 mt-0.5 tracking-[0.02em]">// {invoice.invoiceNumber} · {invoice.status} · {new Date(invoice.createdAt).toTimeString().slice(0, 8)}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6 items-start">
        {/* Invoice preview */}
        <div className="bg-white border border-hairline rounded-2xl shadow-md overflow-hidden">
          {/* Detailed invoice document follows mockup §LEFT */}
          {/* … see mockup file 21-send-invoice.html for exact markup … */}
        </div>

        {/* Send panel */}
        <div className="sticky top-4">
          <div className="bg-card-rd border border-hairline rounded-2xl p-5.5 shadow-md mb-4">
            <h3 className="text-sm font-bold tracking-[-0.01em] text-ink-900 m-0 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-s-delivered)", boxShadow: "0 0 0 3px rgba(5,150,105,0.18)" }} />
              Ready to send
            </h3>
            <p className="text-xs text-ink-500 m-0 mb-4">Pick a delivery method below. Status flips DRAFT → SENT.</p>

            {/* Recipient, subject, message inputs (per mockup) */}

            <div className="flex flex-col gap-2 mb-1.5">
              <button
                type="button"
                onClick={() => showUnderDevToast("Send via email")}
                className="text-left flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-white"
                style={{ background: "var(--color-s-delivered)", filter: "grayscale(0.6)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-base shrink-0">✉</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold leading-[1.2] mb-0.5">Send via email <span className="font-mono text-[9px] bg-ink-300 px-1.5 py-0.5 rounded-full ml-1.5">soon</span></div>
                  <div className="text-[11px] opacity-75 leading-[1.4]">Email the invoice + PDF attachment</div>
                </div>
              </button>
              <button
                type="button"
                onClick={downloadPdfAndMarkSent}
                disabled={submitting}
                className="text-left flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-card-rd border border-hairline hover:-translate-y-0.5 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-canvas-cool flex items-center justify-center text-base shrink-0">⬇</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink-900 leading-[1.2] mb-0.5">Download PDF &amp; mark as sent</div>
                  <div className="text-[11px] text-ink-500 leading-[1.4]">For when you'll send via your own email</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => showUnderDevToast("Copy share link")}
                className="text-left flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-card-rd border border-hairline"
                style={{ filter: "grayscale(0.6)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-canvas-cool flex items-center justify-center text-base shrink-0">🔗</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink-500 leading-[1.2] mb-0.5">Copy share link <span className="font-mono text-[9px] bg-ink-300 text-white px-1.5 py-0.5 rounded-full ml-1.5">soon</span></div>
                  <div className="text-[11px] text-ink-400 leading-[1.4]">View-only invoice page for the client</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={markSent}
              disabled={submitting}
              className="w-full text-center mt-1.5 text-[11px] text-ink-500 hover:text-ink-900"
            >
              or just mark as sent without delivering →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

The full invoice-document JSX inside the left column should follow the mockup exactly: company header (with `ubinsights·` wordmark + billing details), `INVOICE` title, 4-column meta grid (Bill to · Issue · Due · Project), line item table with phase-tagged rows, totals, payment instructions. Use the mockup HTML as the visual source of truth.

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

In the dev environment, manually navigate to `/invoices/<some-draft-invoice-id>/send`. Page renders. Click `Download PDF & mark as sent` → triggers download AND PATCHes invoice to SENT.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(dashboard)/invoices/[id]/send/' src/components/invoices/send-invoice-page.tsx
git commit -m "feat(redesign): Send Invoice full-page flow"
```

---

## Phase 7 — List pages

### Task 21: Restyle the project list page

The project list (`src/app/(dashboard)/projects/page.tsx`) was updated in the 2026-04-27 redesign for the new status enum + billing subtitle. This task applies the new visual tokens, mono numbers, and left-rail-status pattern.

**Files:**
- Modify: `src/app/(dashboard)/projects/page.tsx`

- [ ] **Step 1: Adapt status chips to new tokens**

Find the existing `STATUS_CHIPS` array and replace its rendered chip styling with the new look:

```tsx
{STATUS_CHIPS.map((chip) => (
  <Link
    key={chip.value}
    href={statusFilter === chip.value ? "/projects" : `/projects?status=${chip.value}`}
    className={cn(
      "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all",
      statusFilter === chip.value
        ? "bg-ink-900 text-white"
        : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
    )}
  >
    {chip.label}
  </Link>
))}
```

- [ ] **Step 2: Restyle the list rows with left-rail status indicator**

Find the existing `<TableRow>` rendering and replace the project-name `<TableCell>` to include a 4-px left rail in the status color:

```tsx
<TableCell>
  <div className="flex gap-3">
    <span className="w-1 h-9 rounded-full shrink-0" style={{ background: statusTokens(project.status).dot }} />
    <div>
      <Link href={`/projects/${project.id}`} className="font-mono text-[11px] text-ink-300 tracking-[0.04em] no-underline">
        {project.projectNumber}
      </Link>
      <p className="text-[13px] font-medium text-ink-900 mt-0.5 truncate max-w-[260px]">{project.title}</p>
      {billing.estimated > 0 && (
        <div className="mt-1 max-w-[260px]">
          <div className="font-mono text-[11px] text-ink-400">
            Invoiced <strong className="text-ink-700 font-semibold">{currencySymbol(billing.primaryCurrency)}{billing.invoiced.toLocaleString()}</strong> / {currencySymbol(billing.primaryCurrency)}{billing.estimated.toLocaleString()}
          </div>
          <div className="h-1 mt-1 bg-canvas-cool rounded">
            <div className="h-full rounded" style={{ width: `${pct}%`, background: "var(--color-s-delivered)" }} />
          </div>
        </div>
      )}
    </div>
  </div>
</TableCell>
```

Add `import { statusTokens } from "@/lib/redesign-tokens";` at the top.

- [ ] **Step 3: Restyle the page wrapper / heading**

Replace the heading bar's text classes with the new tokens:

```tsx
<h1 className="text-2xl font-bold tracking-[-0.025em] text-ink-900">Projects</h1>
<p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">// {projects.length} active</p>
```

- [ ] **Step 4: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Open `/projects`. List should render with new visual tokens, left-rail color, mono project numbers, redesigned status chips.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(dashboard)/projects/page.tsx'
git commit -m "feat(redesign): project list with new tokens and left-rail status"
```

---

### Task 22: Light visual pass on Estimates / Invoices / Clients lists

Each of these pages currently has shadcn-default styling. Apply the new tokens (canvas, ink, hairline) without restructuring layouts. This is a fast pass — keep the existing data flow.

**Files:**
- Modify: `src/app/(dashboard)/estimates/page.tsx`
- Modify: `src/app/(dashboard)/invoices/page.tsx`
- Modify: `src/app/(dashboard)/clients/page.tsx`

- [ ] **Step 1: Apply token classes**

In each file, find any of these patterns and replace as listed:

| Find | Replace with |
|---|---|
| `bg-white` (on cards/panels) | `bg-card-rd` |
| `border-gray-200` / `border-slate-200` | `border-hairline` |
| `text-gray-500` / `text-slate-500` | `text-ink-500` |
| `text-gray-900` / `text-slate-900` | `text-ink-900` |
| `bg-gray-50` (page bg) | (remove — layout already provides canvas) |

If the page uses status pills, switch to the new `<StatusPill status={...} />` from `@/components/redesign/status-pill`.

For project numbers / invoice numbers, change to `<span className="font-mono text-[11px] text-ink-300 tracking-[0.04em]">…</span>`.

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
npm run dev
```

Visit each list page. They should look like they belong to the new design system without major layout changes.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(dashboard)/estimates/page.tsx' 'src/app/(dashboard)/invoices/page.tsx' 'src/app/(dashboard)/clients/page.tsx'
git commit -m "refactor(redesign): apply new tokens to estimates, invoices, clients lists"
```

---

## Phase 8 — Polish & smoke test

### Task 23: Final smoke test pass

- [ ] **Step 1: Run the full type check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Both must pass clean for files touched in this redesign. Pre-existing baseline lint warnings in unrelated files (`auth.ts`, `require-auth.ts`, `service-module-checklist.tsx`) are acceptable.

- [ ] **Step 2: Build**

```bash
npm run build
```

The TypeScript phase ("Compiled successfully · Running TypeScript") must pass clean. The static-export phase has known pre-existing timeouts on `/clients` and `/templates`; those are baseline issues, not introduced by this redesign.

- [ ] **Step 3: End-to-end browser walkthrough**

```bash
npm run dev
# log in as yushi@ubinsights.com / ubi12345
```

Walk through:

1. **Dashboard** — landing page shows "Hi, [name]" with terracotta accent + mono timestamp + 4-tab hub toggle. Hub 1 (Inquiry) is active by default.
2. Switch to each hub via tabs — URL updates with `?hub=…`. Each hub shows its cockpit, sub-status groups, tools area, right rail.
3. Click any tool card in any hub — toast appears: "[Tool] is under development. // Coming in a future release".
4. **Project detail** — click any project. Header shows breadcrumbs + status pill + 4-stage card row. Tab strip uses underline style.
5. For a Stage 1 (NEW/BRIEFED/ESTIMATING/APPROVED) project, the Estimates tab is active by default.
6. For a Stage 3 (DELIVERED) project, Confirm Actuals tab is active. Edit a delivered quantity → variance chip updates inline. Click `✓ Confirm & generate draft invoice` → POSTs and redirects to `/invoices/[newId]/send`.
7. **Send Invoice page** — invoice document renders on left, send panel on right. Click `Download PDF & mark as sent` → PDF opens AND invoice flips to SENT, redirected back to dashboard `?hub=completion`.
8. Mark an invoice paid in Hub 3 — project status independent (existing behavior from 2026-04-27 redesign).
9. **Project list** — left-rail status color, mono project numbers, billing subtitle.

If any step fails, fix and recommit before declaring the redesign complete.

- [ ] **Step 4: Commit any final touch-ups**

```bash
git status
git add -A
git commit -m "chore(redesign): final touch-ups from end-to-end smoke test"
```

---

## Self-review checklist

Before handing off, the planner verified:

1. **Spec coverage**
   - §4 Design system → Tasks 1–3
   - §5 Information architecture → Tasks 7, 11–15
   - §6.1 Hub 1 Inquiry → Task 12
   - §6.2 Hub 2 In Progress → Task 13
   - §6.3 Hub 3 Completion → Task 14
   - §6.4 Hub 4 Archive → Task 15
   - §7.1 Project detail common header → Task 16
   - §7.2 Stage 1 view → Task 17 (default tab + minor layout)
   - §7.3 Stage 2 view → Task 18 (gray placeholder for deliverables)
   - §7.4.1 Confirm Actuals → Task 19
   - §7.4.2 Send Invoice → Task 20
   - §6.5 Project list → Task 21
   - §11 Implementation phases → Tasks structured around them
   - Indicative-info / interactive-element principle (§4.4) → enforced throughout via cockpit-on-canvas + cards-for-buttons pattern

2. **Placeholder scan:** none. All steps include exact code or exact commands. Two areas use phrases like "follow the mockup" — Task 19 (Confirm Actuals) and Task 20 (Send Invoice) — because the mockup files are the source of visual truth and inlining 400+ lines of HTML per task would obscure the work. The mockup paths are referenced explicitly.

3. **Type consistency:**
   - `StatusPill` (Task 4) is consumed by Tasks 16, 21, 22
   - `Cockpit`, `Readout`, `StatusRow` (Task 6) are consumed by Tasks 12–15
   - `HubTabBar` (Task 7) is consumed by Task 11
   - `GrayToolCard` (Task 8) is consumed by Tasks 12–15
   - `showUnderDevToast` (Task 5) is consumed by Tasks 8, 18, 20
   - `statusTokens` / `phaseTokens` (Task 3) consumed by Tasks 4, 13, 21
   - `currencySymbol` (existing in `src/lib/currency.ts`) consumed throughout

4. **No new dependencies:** the plan uses only `next/font/google` (already used) and Tailwind v4's existing token system. No new npm packages required.

5. **No schema or API changes:** verified — every endpoint referenced (`PATCH /api/projects/[id]/delivery`, `PATCH /api/projects/[id]/completion`, `POST /api/projects/[id]/invoices`, `PATCH /api/invoices/[id]`, `GET /api/invoices/[id]/pdf`) already exists from the 2026-04-27 redesign.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-28-visual-redesign-with-hubs.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

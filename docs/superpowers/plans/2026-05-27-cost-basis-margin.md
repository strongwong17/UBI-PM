# Cost Basis & Margin Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level cost ledger, compute planned/delivered margin (incentives excluded as passthrough), and surface financial health in a sidebar Financials dashboard (overall company margin, by-company expandable, by-individual/BD) plus a per-project cost builder.

**Architecture:** Cost is a new project-scoped `CostLineItem` ledger (decoupled from revenue lines). Revenue keeps coming from the existing approved-estimate billing math (`estimate-totals.ts`). A pure `margin.ts` layer combines them. Server components read via `prisma`; a client cost editor saves through a new costs API. ADMIN/MANAGER only.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (`src/generated/prisma`), PostgreSQL, vitest (new, for margin math), shadcn/ui, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-27-cost-basis-margin-design.md`

---

## File Structure

**Create:**
- `vitest.config.ts` — vitest config with `@` alias, node env
- `src/lib/margin.ts` — pure margin/cost/passthrough math
- `src/lib/margin.test.ts` — vitest unit tests
- `src/lib/financials.ts` — project→margin assembly + company rollup/grouping (server-safe, uses prisma types only)
- `src/app/api/projects/[id]/costs/route.ts` — GET/PUT cost ledger
- `src/app/api/projects/[id]/revenue-passthrough/route.ts` — PATCH isPassthrough on one estimate line
- `src/components/financials/cost-line-editor.tsx` — editable cost builder (client)
- `src/components/financials/bd-owner-select.tsx` — BD/owner selector (client)
- `src/components/financials/financials-table.tsx` — by-company expandable + group/filter controls (client)
- `src/app/(dashboard)/financials/page.tsx` — company dashboard (server)
- `src/app/(dashboard)/financials/[projectId]/page.tsx` — project financial detail (server)

**Modify:**
- `prisma/schema.prisma` — `CostLineItem` model, `EstimateLineItem.isPassthrough`, `Project.businessDevId` + `User` inverse
- `package.json` — vitest devDep + `test` scripts
- `src/app/api/projects/[id]/route.ts` — accept `businessDevId` in PATCH
- `src/components/layout/sidebar.tsx` — add Financials nav item (ADMIN/MANAGER)

---

## Phase 1 — Foundation (schema, margin math, cost API)

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `isPassthrough` to `EstimateLineItem`**

In `model EstimateLineItem`, after the `serviceModuleType String?` line add:
```prisma
  isPassthrough     Boolean @default(false)
```

- [ ] **Step 2: Add `businessDevId` to `Project`**

In `model Project`, after the `assignedTo ... @relation("ProjectAssignee" ...)` line add:
```prisma
  businessDevId    String?
  businessDev      User?          @relation("ProjectBusinessDev", fields: [businessDevId], references: [id])
```

- [ ] **Step 3: Add inverse relation + cost ledger relation to `User` is not needed; add inverse on `User`**

In `model User`, after `assignedProjects Project[] @relation("ProjectAssignee")` add:
```prisma
  businessDevProjects    Project[]          @relation("ProjectBusinessDev")
```

- [ ] **Step 4: Add `CostLineItem` model + relation on `Project`**

In `model Project`, in the relations block (near `invoices Invoice[]`) add:
```prisma
  costLineItems CostLineItem[]
```
Then add a new model at the end of the file:
```prisma
model CostLineItem {
  id          String   @id @default(cuid())
  description String
  costType    String   @default("FLAT") // "HOURS" | "FLAT"
  hours       Float?
  rate        Float?
  amount      Float?
  category    String?
  sortOrder   Int      @default(0)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 5: Create + apply the migration (local dev DB)**

Run: `npx prisma migrate dev --name add_cost_basis_margin`
Expected: migration created under `prisma/migrations/...add_cost_basis_margin/`, applied, and "✔ Generated Prisma Client".

- [ ] **Step 6: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(financials): schema for cost ledger, passthrough flag, BD owner"
```

---

### Task 2: vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`
Expected: vitest added to devDependencies.

- [ ] **Step 2: Add test scripts to `package.json`**

In `"scripts"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: vitest runs and reports "No test files found" (exit 0 or a benign no-tests message) — confirms config loads.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add vitest for financial math"
```

---

### Task 3: Margin math library (TDD)

**Files:**
- Create: `src/lib/margin.ts`
- Test: `src/lib/margin.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/margin.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  lineCost,
  isPassthroughRevenueLine,
  estimateNetRevenue,
  estimatePassthrough,
  computeProjectMargin,
  type MarginEstimate,
} from "@/lib/margin";

function line(over: Partial<any> = {}) {
  return {
    id: over.id ?? "l" + Math.random(),
    description: "x",
    quantity: 1,
    unitPrice: 0,
    deliveredQuantity: null,
    percentageBasis: null,
    percentageRate: null,
    basisPhaseName: null,
    basisLineItemDesc: null,
    serviceModuleType: null,
    isPassthrough: false,
    ...over,
  };
}

const estimate: MarginEstimate = {
  isApproved: true,
  parentEstimateId: null,
  currency: "USD",
  phases: [
    {
      name: "Fieldwork",
      lineItems: [
        line({ id: "rec", quantity: 40, unitPrice: 150, deliveredQuantity: 38 }), // 6000 / 5700
        line({ id: "mod", quantity: 20, unitPrice: 200, deliveredQuantity: 20 }), // 4000 / 4000
        line({ id: "inc", quantity: 1, unitPrice: 5000, deliveredQuantity: 1, serviceModuleType: "INCENTIVES" }), // passthrough
        line({ id: "ven", quantity: 1, unitPrice: 2000, deliveredQuantity: 1, isPassthrough: true }), // manual passthrough override
      ],
    },
  ],
};

describe("lineCost", () => {
  it("computes HOURS as hours*rate", () => {
    expect(lineCost({ costType: "HOURS", hours: 60, rate: 40, amount: null })).toBe(2400);
  });
  it("computes FLAT as amount", () => {
    expect(lineCost({ costType: "FLAT", hours: null, rate: null, amount: 1500 })).toBe(1500);
  });
  it("treats null fields as 0", () => {
    expect(lineCost({ costType: "HOURS", hours: null, rate: 40, amount: null })).toBe(0);
    expect(lineCost({ costType: "FLAT", hours: null, rate: null, amount: null })).toBe(0);
  });
});

describe("isPassthroughRevenueLine", () => {
  it("flags INCENTIVES module", () => {
    expect(isPassthroughRevenueLine({ serviceModuleType: "INCENTIVES", isPassthrough: false })).toBe(true);
  });
  it("flags explicit override", () => {
    expect(isPassthroughRevenueLine({ serviceModuleType: null, isPassthrough: true })).toBe(true);
  });
  it("normal line is not passthrough", () => {
    expect(isPassthroughRevenueLine({ serviceModuleType: "RECRUITMENT", isPassthrough: false })).toBe(false);
  });
});

describe("estimateNetRevenue / estimatePassthrough", () => {
  it("excludes passthrough lines from net revenue (planned)", () => {
    // 6000 + 4000 = 10000 (inc 5000 + ven 2000 excluded)
    expect(estimateNetRevenue(estimate, (l) => l.quantity)).toBe(10000);
  });
  it("uses delivered quantities", () => {
    // 5700 + 4000 = 9700
    expect(estimateNetRevenue(estimate, (l) => l.deliveredQuantity ?? 0)).toBe(9700);
  });
  it("sums passthrough separately", () => {
    expect(estimatePassthrough(estimate, (l) => l.quantity)).toBe(7000); // 5000 + 2000
  });
});

describe("computeProjectMargin", () => {
  it("nets cost against planned & delivered revenue, excludes passthrough", () => {
    const m = computeProjectMargin({
      estimates: [estimate],
      costLineItems: [
        { costType: "HOURS", hours: 60, rate: 40, amount: null }, // 2400
        { costType: "FLAT", hours: null, rate: null, amount: 1600 }, // 1600
      ],
    });
    expect(m.plannedRevenue).toBe(10000);
    expect(m.deliveredRevenue).toBe(9700);
    expect(m.cost).toBe(4000);
    expect(m.plannedMargin).toBe(6000);
    expect(m.deliveredMargin).toBe(5700);
    expect(m.passthrough).toBe(7000);
    expect(m.plannedMarginPct).toBeCloseTo(60);
    expect(m.currency).toBe("USD");
  });
  it("guards divide-by-zero when no revenue", () => {
    const m = computeProjectMargin({ estimates: [], costLineItems: [] });
    expect(m.plannedMarginPct).toBe(0);
    expect(m.deliveredMarginPct).toBe(0);
  });
  it("ignores unapproved and RMB-duplicate estimates", () => {
    const m = computeProjectMargin({
      estimates: [
        { ...estimate, isApproved: false },
        { ...estimate, parentEstimateId: "parent" },
      ],
      costLineItems: [],
    });
    expect(m.plannedRevenue).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/margin'` / exports undefined.

- [ ] **Step 3: Implement `src/lib/margin.ts`**
```ts
// Pure margin/cost/passthrough math. No prisma/DB imports — testable in isolation.
import { mapEstimateToBillingPhases, type EstimateForBilling } from "@/lib/estimate-billing";
import { resolveLineTotal, plannedQty, deliveredQty, type QuantitySelector } from "@/lib/estimate-totals";

export interface MarginCostLine {
  costType: string; // "HOURS" | "FLAT"
  hours: number | null;
  rate: number | null;
  amount: number | null;
}

export function lineCost(c: MarginCostLine): number {
  return c.costType === "HOURS" ? (c.hours ?? 0) * (c.rate ?? 0) : (c.amount ?? 0);
}

export function isPassthroughRevenueLine(li: {
  serviceModuleType: string | null;
  isPassthrough: boolean;
}): boolean {
  return li.serviceModuleType === "INCENTIVES" || li.isPassthrough;
}

interface MarginEstimateLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
  serviceModuleType: string | null;
  isPassthrough: boolean;
}

export interface MarginEstimate extends EstimateForBilling {
  isApproved: boolean;
  parentEstimateId: string | null;
  currency: string;
  phases: { name: string; lineItems: MarginEstimateLine[] }[];
}

function passthroughIds(estimate: MarginEstimate): Set<string> {
  const s = new Set<string>();
  for (const p of estimate.phases) {
    for (const li of p.lineItems) {
      if (isPassthroughRevenueLine(li)) s.add(li.id);
    }
  }
  return s;
}

/** Net revenue = all line totals minus passthrough lines. NOTE: passthrough
 *  lines are still present in the basis of percentage lines (incentives are
 *  fixed lines in practice — see spec "Open risks"). */
export function estimateNetRevenue(estimate: MarginEstimate, getQty: QuantitySelector): number {
  const phases = mapEstimateToBillingPhases(estimate);
  const pt = passthroughIds(estimate);
  return phases.reduce(
    (s, ph) => s + ph.lines.reduce((ss, l) => ss + (pt.has(l.id) ? 0 : resolveLineTotal(l, phases, getQty)), 0),
    0
  );
}

export function estimatePassthrough(estimate: MarginEstimate, getQty: QuantitySelector): number {
  const phases = mapEstimateToBillingPhases(estimate);
  const pt = passthroughIds(estimate);
  return phases.reduce(
    (s, ph) => s + ph.lines.reduce((ss, l) => ss + (pt.has(l.id) ? resolveLineTotal(l, phases, getQty) : 0), 0),
    0
  );
}

export interface ProjectMargin {
  primaryCurrency: string;
  currency: string;
  plannedRevenue: number;
  deliveredRevenue: number;
  cost: number;
  passthrough: number;
  plannedMargin: number;
  deliveredMargin: number;
  plannedMarginPct: number;
  deliveredMarginPct: number;
}

export interface ProjectForMargin {
  estimates: MarginEstimate[];
  costLineItems: MarginCostLine[];
}

export function computeProjectMargin(project: ProjectForMargin): ProjectMargin {
  const primaryCurrency =
    project.estimates.find((e) => e.isApproved && !e.parentEstimateId)?.currency ?? "USD";

  let plannedRevenue = 0;
  let deliveredRevenue = 0;
  let passthrough = 0;
  for (const est of project.estimates) {
    if (!est.isApproved || est.parentEstimateId || est.currency !== primaryCurrency) continue;
    plannedRevenue += estimateNetRevenue(est, plannedQty);
    deliveredRevenue += estimateNetRevenue(est, deliveredQty);
    passthrough += estimatePassthrough(est, plannedQty);
  }

  const cost = project.costLineItems.reduce((s, c) => s + lineCost(c), 0);
  const plannedMargin = plannedRevenue - cost;
  const deliveredMargin = deliveredRevenue - cost;
  const pct = (m: number, r: number) => (r > 0 ? (m / r) * 100 : 0);

  return {
    primaryCurrency,
    currency: primaryCurrency,
    plannedRevenue,
    deliveredRevenue,
    cost,
    passthrough,
    plannedMargin,
    deliveredMargin,
    plannedMarginPct: pct(plannedMargin, plannedRevenue),
    deliveredMarginPct: pct(deliveredMargin, deliveredRevenue),
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test`
Expected: PASS — all margin tests green.

- [ ] **Step 5: Commit**
```bash
git add src/lib/margin.ts src/lib/margin.test.ts
git commit -m "feat(financials): margin/cost/passthrough math + tests"
```

---

### Task 4: Cost ledger API

**Files:**
- Create: `src/app/api/projects/[id]/costs/route.ts`

- [ ] **Step 1: Implement GET + PUT**
```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { id } = await params;
  const costLineItems = await prisma.costLineItem.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(costLineItems);
}

interface IncomingCostLine {
  description?: string;
  costType?: string;
  hours?: number | null;
  rate?: number | null;
  amount?: number | null;
  category?: string | null;
  notes?: string | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, projectNumber: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json();
  const lines: IncomingCostLine[] = Array.isArray(body.lineItems) ? body.lineItems : [];

  await prisma.$transaction(async (tx) => {
    await tx.costLineItem.deleteMany({ where: { projectId: id } });
    if (lines.length > 0) {
      await tx.costLineItem.createMany({
        data: lines.map((l, idx) => ({
          projectId: id,
          description: l.description ?? "",
          costType: l.costType === "HOURS" ? "HOURS" : "FLAT",
          hours: l.hours ?? null,
          rate: l.rate ?? null,
          amount: l.amount ?? null,
          category: l.category ?? null,
          notes: l.notes ?? null,
          sortOrder: idx,
        })),
      });
    }
  });

  await logActivity({
    action: "UPDATE",
    entityType: "PROJECT",
    entityId: id,
    entityLabel: project.projectNumber,
    description: `Updated cost ledger (${lines.length} lines)`,
    userId,
    projectId: id,
  });

  const costLineItems = await prisma.costLineItem.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(costLineItems);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add "src/app/api/projects/[id]/costs/route.ts"
git commit -m "feat(financials): cost ledger GET/PUT API"
```

---

## Phase 2 — Project financial detail

### Task 5: BD owner field in project PATCH

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`

- [ ] **Step 1: Accept `businessDevId` in the PATCH body destructure**

Change the destructure line (currently):
```ts
    const { status, title, executionPhase, primaryContactId, assignedToId, startDate, endDate, notes } = body;
```
to add `businessDevId`:
```ts
    const { status, title, executionPhase, primaryContactId, assignedToId, businessDevId, startDate, endDate, notes } = body;
```

- [ ] **Step 2: Persist it in the update `data` block**

After the `...(assignedToId !== undefined && { assignedToId }),` line add:
```ts
        ...(businessDevId !== undefined && { businessDevId }),
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add "src/app/api/projects/[id]/route.ts"
git commit -m "feat(financials): accept businessDevId in project PATCH"
```

---

### Task 6: Cost line editor component

**Files:**
- Create: `src/components/financials/cost-line-editor.tsx`

- [ ] **Step 1: Implement the editable cost builder**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface CostLine {
  id: string;
  description: string;
  costType: string; // HOURS | FLAT
  hours: number | null;
  rate: number | null;
  amount: number | null;
}

interface Props {
  projectId: string;
  currencySymbol: string;
  initial: CostLine[];
}

function lineCost(l: CostLine): number {
  return l.costType === "HOURS" ? (l.hours ?? 0) * (l.rate ?? 0) : (l.amount ?? 0);
}

let tmp = 0;
const newId = () => `tmp-${tmp++}`;

export function CostLineEditor({ projectId, currencySymbol, initial }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<CostLine[]>(initial);
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<CostLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: newId(), description: "", costType: "FLAT", hours: null, rate: null, amount: null },
    ]);
  }
  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const total = lines.reduce((s, l) => s + lineCost(l), 0);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: lines.map((l) => ({
            description: l.description,
            costType: l.costType,
            hours: l.costType === "HOURS" ? l.hours : null,
            rate: l.costType === "HOURS" ? l.rate : null,
            amount: l.costType === "FLAT" ? l.amount : null,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(d.error || "Failed to save costs");
      }
      toast.success("Costs saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save costs");
    } finally {
      setSaving(false);
    }
  }

  const num = (v: number | null) => (v === null || Number.isNaN(v) ? "" : String(v));
  const parse = (s: string) => (s === "" ? null : Number(s));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Cost line (e.g. Recruiter labor)"
              value={l.description}
              onChange={(e) => update(l.id, { description: e.target.value })}
            />
            <div className="inline-flex rounded-md border border-hairline-strong overflow-hidden text-[11px] font-mono">
              <button
                type="button"
                className={l.costType === "HOURS" ? "px-2 py-1 bg-accent-rd text-white" : "px-2 py-1 text-ink-500"}
                onClick={() => update(l.id, { costType: "HOURS" })}
              >
                HRS
              </button>
              <button
                type="button"
                className={l.costType === "FLAT" ? "px-2 py-1 bg-accent-rd text-white" : "px-2 py-1 text-ink-500"}
                onClick={() => update(l.id, { costType: "FLAT" })}
              >
                FLAT
              </button>
            </div>
            {l.costType === "HOURS" ? (
              <>
                <Input
                  className="w-20"
                  type="number"
                  placeholder="hrs"
                  value={num(l.hours)}
                  onChange={(e) => update(l.id, { hours: parse(e.target.value) })}
                />
                <span className="text-ink-400 text-[12px]">×</span>
                <Input
                  className="w-24"
                  type="number"
                  placeholder="rate"
                  value={num(l.rate)}
                  onChange={(e) => update(l.id, { rate: parse(e.target.value) })}
                />
              </>
            ) : (
              <Input
                className="w-32"
                type="number"
                placeholder="amount"
                value={num(l.amount)}
                onChange={(e) => update(l.id, { amount: parse(e.target.value) })}
              />
            )}
            <div className="w-28 text-right font-mono text-[13px] rd-tabular">
              {currencySymbol}
              {lineCost(l).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button type="button" className="text-accent-rd" onClick={() => removeLine(l.id)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-hairline">
        <Button variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add cost line
        </Button>
        <div className="flex items-center gap-4">
          <div className="font-mono text-[13px]">
            Total cost:{" "}
            <span className="font-bold text-accent-rd rd-tabular">
              {currencySymbol}
              {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add src/components/financials/cost-line-editor.tsx
git commit -m "feat(financials): editable cost line builder"
```

---

### Task 7: BD owner selector + revenue-passthrough API

**Files:**
- Create: `src/components/financials/bd-owner-select.tsx`
- Create: `src/app/api/projects/[id]/revenue-passthrough/route.ts`

- [ ] **Step 1: Implement `bd-owner-select.tsx`**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  projectId: string;
  users: { id: string; name: string }[];
  current: string | null;
}

const UNASSIGNED = "__none__";

export function BdOwnerSelect({ projectId, users, current }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? UNASSIGNED);

  async function onChange(next: string) {
    setValue(next);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessDevId: next === UNASSIGNED ? null : next }),
      });
      if (!res.ok) throw new Error("Failed to update owner");
      toast.success("BD owner updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update owner");
    }
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52 h-8 text-[12px]">
        <SelectValue placeholder="BD owner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Implement `revenue-passthrough/route.ts`**
```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(["ADMIN", "MANAGER"]);
  if (isAuthError(authResult)) return authResult;
  const { id } = await params;
  const { estimateLineItemId, isPassthrough } = await request.json();

  if (typeof estimateLineItemId !== "string" || typeof isPassthrough !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verify the line belongs to an estimate on this project.
  const line = await prisma.estimateLineItem.findUnique({
    where: { id: estimateLineItemId },
    select: { id: true, phase: { select: { estimate: { select: { projectId: true } } } } },
  });
  if (!line || line.phase.estimate.projectId !== id) {
    return NextResponse.json({ error: "Line not found for this project" }, { status: 404 });
  }

  await prisma.estimateLineItem.update({
    where: { id: estimateLineItemId },
    data: { isPassthrough },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add src/components/financials/bd-owner-select.tsx "src/app/api/projects/[id]/revenue-passthrough/route.ts"
git commit -m "feat(financials): BD owner selector + revenue passthrough toggle API"
```

---

### Task 8: financials.ts assembly helper

**Files:**
- Create: `src/lib/financials.ts`

- [ ] **Step 1: Implement project loader + company rollup**
```ts
import { prisma } from "@/lib/prisma";
import { computeProjectMargin, type MarginEstimate, type ProjectMargin } from "@/lib/margin";

const estimateInclude = {
  phases: {
    include: {
      lineItems: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          deliveredQuantity: true,
          percentageBasis: true,
          percentageRate: true,
          basisPhaseName: true,
          basisLineItemDesc: true,
          serviceModuleType: true,
          isPassthrough: true,
        },
      },
    },
  },
} as const;

function toMarginEstimate(est: any): MarginEstimate {
  return {
    isApproved: est.isApproved,
    parentEstimateId: est.parentEstimateId,
    currency: est.currency,
    phases: est.phases.map((p: any) => ({
      name: p.name,
      lineItems: p.lineItems.map((li: any) => ({
        ...li,
        deliveredQuantity: li.deliveredQuantity ?? null,
        percentageBasis: li.percentageBasis ?? null,
        percentageRate: li.percentageRate ?? null,
        basisPhaseName: li.basisPhaseName ?? null,
        basisLineItemDesc: li.basisLineItemDesc ?? null,
        serviceModuleType: li.serviceModuleType ?? null,
        isPassthrough: li.isPassthrough ?? false,
      })),
    })),
  };
}

export interface ProjectFinancialRow {
  projectId: string;
  projectNumber: string;
  title: string;
  status: string;
  clientId: string;
  company: string;
  ownerId: string | null;
  ownerName: string | null;
  margin: ProjectMargin;
}

/** All projects with at least one approved estimate, with margin computed.
 *  usdOnly restricts to USD primary-currency projects (company dashboard). */
export async function loadProjectFinancials(opts: { usdOnly?: boolean } = {}): Promise<ProjectFinancialRow[]> {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { id: true, company: true } },
      businessDev: { select: { id: true, name: true } },
      estimates: { include: estimateInclude },
      costLineItems: { select: { costType: true, hours: true, rate: true, amount: true } },
    },
  });

  const rows: ProjectFinancialRow[] = [];
  for (const p of projects) {
    const hasApproved = p.estimates.some((e) => e.isApproved && !e.parentEstimateId);
    if (!hasApproved) continue;
    const margin = computeProjectMargin({
      estimates: p.estimates.map(toMarginEstimate),
      costLineItems: p.costLineItems,
    });
    if (opts.usdOnly && margin.currency !== "USD") continue;
    rows.push({
      projectId: p.id,
      projectNumber: p.projectNumber,
      title: p.title,
      status: p.status,
      clientId: p.client.id,
      company: p.client.company,
      ownerId: p.businessDev?.id ?? null,
      ownerName: p.businessDev?.name ?? null,
      margin,
    });
  }
  return rows;
}

/** Single project's margin (detail page). Returns null if project missing. */
export async function loadOneProjectMargin(projectId: string): Promise<ProjectMargin | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      estimates: { include: estimateInclude },
      costLineItems: { select: { costType: true, hours: true, rate: true, amount: true } },
    },
  });
  if (!p) return null;
  return computeProjectMargin({
    estimates: p.estimates.map(toMarginEstimate),
    costLineItems: p.costLineItems,
  });
}

export function sumMargins(rows: ProjectFinancialRow[]) {
  const revenue = rows.reduce((s, r) => s + r.margin.plannedRevenue, 0);
  const delivered = rows.reduce((s, r) => s + r.margin.deliveredRevenue, 0);
  const cost = rows.reduce((s, r) => s + r.margin.cost, 0);
  const passthrough = rows.reduce((s, r) => s + r.margin.passthrough, 0);
  const margin = revenue - cost;
  return {
    revenue,
    delivered,
    cost,
    passthrough,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
    count: rows.length,
  };
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add src/lib/financials.ts
git commit -m "feat(financials): project margin loaders + company rollup"
```

---

### Task 9: Project financial detail page

**Files:**
- Create: `src/app/(dashboard)/financials/[projectId]/page.tsx`

- [ ] **Step 1: Implement the detail page**
```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currencySymbol } from "@/lib/currency";
import { loadOneProjectMargin } from "@/lib/financials";
import { isPassthroughRevenueLine } from "@/lib/margin";
import { CostLineEditor } from "@/components/financials/cost-line-editor";
import { BdOwnerSelect } from "@/components/financials/bd-owner-select";
import { ArrowLeft } from "lucide-react";

export default async function ProjectFinancialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { company: true } },
      businessDev: { select: { id: true } },
      estimates: {
        where: { isApproved: true, parentEstimateId: null },
        include: { phases: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
      },
      costLineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) notFound();

  const margin = (await loadOneProjectMargin(projectId))!;
  const sym = currencySymbol(margin.currency);
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const revenueLines = project.estimates.flatMap((e) =>
    e.phases.flatMap((ph) =>
      ph.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        module: li.serviceModuleType,
        revenue: li.quantity * li.unitPrice,
        passthrough: isPassthroughRevenueLine({ serviceModuleType: li.serviceModuleType, isPassthrough: li.isPassthrough }),
      }))
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/financials" className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Financials
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-900 m-0">
            {project.client.company} — {project.title}
          </h1>
          <BdOwnerSelect projectId={project.id} users={users} current={project.businessDev?.id ?? null} />
        </div>
      </div>

      {/* margin summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="// NET REVENUE" main={fmt(margin.plannedRevenue)} sub={`${fmt(margin.deliveredRevenue)} delivered`} />
        <SummaryCard label="// COST" main={fmt(margin.cost)} accent />
        <SummaryCard label="// MARGIN" main={`${fmt(margin.plannedMargin)} · ${margin.plannedMarginPct.toFixed(1)}%`} sub={`${fmt(margin.deliveredMargin)} · ${margin.deliveredMarginPct.toFixed(1)}% delivered`} good />
        <SummaryCard label="// PASSTHROUGH" main={fmt(margin.passthrough)} sub="incentives, excluded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue (read-only) */}
        <section>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// REVENUE · from approved estimate"}</p>
          <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
            {revenueLines.map((rl) => (
              <div key={rl.id} className={`flex justify-between py-2 text-[13px] ${rl.passthrough ? "text-ink-400" : "text-ink-900"}`} style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                <span>{rl.description}{rl.passthrough ? "  · passthrough" : ""}</span>
                <span className="font-mono rd-tabular">{rl.passthrough ? "excl." : fmt(rl.revenue)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold text-[13px]">
              <span>Net revenue</span>
              <span className="font-mono rd-tabular">{fmt(margin.plannedRevenue)}</span>
            </div>
          </div>
        </section>

        {/* Costs (editable) */}
        <section>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// COSTS / EXPENSES"}</p>
          <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
            <CostLineEditor
              projectId={project.id}
              currencySymbol={sym}
              initial={project.costLineItems.map((c) => ({
                id: c.id,
                description: c.description,
                costType: c.costType,
                hours: c.hours,
                rate: c.rate,
                amount: c.amount,
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, main, sub, good, accent }: { label: string; main: string; sub?: string; good?: boolean; accent?: boolean }) {
  return (
    <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
      <div className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1.5">{label}</div>
      <div className={`text-[18px] font-bold rd-tabular ${good ? "text-[color:var(--color-s-delivered-fg)]" : accent ? "text-accent-rd" : "text-ink-900"}`}>{main}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `text-[color:var(...)]` arbitrary value errors, replace the `good` class with `text-emerald-700`.)

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`, visit `/financials/<an approved project id>`. Confirm revenue lines render (incentives marked "passthrough/excl."), add a cost line, Save → toast + totals update.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(dashboard)/financials/[projectId]/page.tsx"
git commit -m "feat(financials): per-project financial detail page"
```

---

## Phase 3 — Company dashboard

### Task 10: Financials table (client) — grouping + expandable

**Files:**
- Create: `src/components/financials/financials-table.tsx`

- [ ] **Step 1: Implement the client table with group/filter + company expand**
```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface Row {
  projectId: string;
  projectNumber: string;
  title: string;
  status: string;
  company: string;
  ownerId: string | null;
  ownerName: string | null;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

type Group = "company" | "owner" | "flat";

export function FinancialsTable({ rows, sym }: { rows: Row[]; sym: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>("company");
  const [status, setStatus] = useState<string>("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => (status === "ALL" ? rows : rows.filter((r) => r.status === status)),
    [rows, status]
  );

  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = (m: number, r: number) => (r > 0 ? ((m / r) * 100).toFixed(1) + "%" : "—");

  const groups = useMemo(() => {
    if (group === "flat") return null;
    const key = (r: Row) => (group === "company" ? r.company : r.ownerName ?? "Unassigned");
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const k = key(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([name, items]) => {
        const revenue = items.reduce((s, r) => s + r.revenue, 0);
        const cost = items.reduce((s, r) => s + r.cost, 0);
        return { name, items, revenue, cost, margin: revenue - cost };
      })
      .sort((a, b) => b.margin - a.margin);
  }, [filtered, group]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[11px] font-mono text-ink-500">
        <span>Group:</span>
        {(["company", "owner", "flat"] as Group[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={group === g ? "text-accent-rd font-bold" : "hover:text-ink-900"}
          >
            {g}
          </button>
        ))}
        <span className="ml-4">Status:</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-hairline-strong rounded px-1 py-0.5 bg-transparent">
          {["ALL", "IN_PROGRESS", "DELIVERED", "CLOSED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left font-mono text-[9px] uppercase tracking-[0.05em] text-ink-400">
            <th className="py-2">Project / group</th><th>Owner</th><th>Status</th>
            <th className="text-right">Revenue</th><th className="text-right">Cost</th>
            <th className="text-right">Margin</th><th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {group === "flat"
            ? filtered.map((r) => <ProjectRow key={r.projectId} r={r} sym={sym} onClick={() => router.push(`/financials/${r.projectId}`)} />)
            : groups!.map((g) => (
                <FragmentGroup
                  key={g.name}
                  g={g}
                  open={!!expanded[g.name]}
                  toggle={() => setExpanded((p) => ({ ...p, [g.name]: !p[g.name] }))}
                  sym={sym}
                  fmt={fmt}
                  pct={pct}
                  onProject={(id) => router.push(`/financials/${id}`)}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectRow({ r, sym, onClick }: { r: Row; sym: string; onClick: () => void }) {
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return (
    <tr className="border-t border-hairline hover:bg-[#FCFAF6] cursor-pointer" onClick={onClick}>
      <td className="py-2 pl-4">{r.title} <span className="font-mono text-[10px] text-ink-400">{r.projectNumber}</span></td>
      <td className="text-ink-500">{r.ownerName ?? "—"}</td>
      <td><span className="font-mono text-[9px] text-ink-500">{r.status}</span></td>
      <td className="text-right rd-tabular">{fmt(r.revenue)}</td>
      <td className="text-right rd-tabular text-accent-rd">{fmt(r.cost)}</td>
      <td className="text-right rd-tabular">{fmt(r.margin)}</td>
      <td className="text-right rd-tabular">{r.revenue > 0 ? ((r.margin / r.revenue) * 100).toFixed(1) + "%" : "—"}</td>
    </tr>
  );
}

function FragmentGroup({
  g, open, toggle, sym, fmt, pct, onProject,
}: {
  g: { name: string; items: Row[]; revenue: number; cost: number; margin: number };
  open: boolean; toggle: () => void; sym: string;
  fmt: (n: number) => string; pct: (m: number, r: number) => string;
  onProject: (id: string) => void;
}) {
  return (
    <>
      <tr className="border-t border-hairline-strong bg-[#FAF8F2] font-semibold cursor-pointer" onClick={toggle}>
        <td className="py-2">{open ? "▾" : "▸"} {g.name} <span className="font-mono text-[10px] text-ink-400">{g.items.length} prj</span></td>
        <td></td><td></td>
        <td className="text-right rd-tabular">{fmt(g.revenue)}</td>
        <td className="text-right rd-tabular text-accent-rd">{fmt(g.cost)}</td>
        <td className="text-right rd-tabular">{fmt(g.margin)}</td>
        <td className="text-right rd-tabular">{pct(g.margin, g.revenue)}</td>
      </tr>
      {open && g.items.map((r) => <ProjectRow key={r.projectId} r={r} sym={sym} onClick={() => onProject(r.projectId)} />)}
    </>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add src/components/financials/financials-table.tsx
git commit -m "feat(financials): grouped/expandable financials table"
```

---

### Task 11: Company dashboard page

**Files:**
- Create: `src/app/(dashboard)/financials/page.tsx`

- [ ] **Step 1: Implement the dashboard page**
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadProjectFinancials, sumMargins } from "@/lib/financials";
import { FinancialsTable, type Row } from "@/components/financials/financials-table";

export default async function FinancialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const projectRows = await loadProjectFinancials({ usdOnly: true });
  const totals = sumMargins(projectRows);
  const sym = "$";
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  // by-owner rollup
  const ownerMap = new Map<string, { name: string; revenue: number; cost: number; count: number }>();
  for (const r of projectRows) {
    const key = r.ownerId ?? "none";
    const name = r.ownerName ?? "Unassigned";
    const o = ownerMap.get(key) ?? { name, revenue: 0, cost: 0, count: 0 };
    o.revenue += r.margin.plannedRevenue;
    o.cost += r.margin.cost;
    o.count += 1;
    ownerMap.set(key, o);
  }
  const owners = Array.from(ownerMap.values());

  const rows: Row[] = projectRows.map((r) => ({
    projectId: r.projectId,
    projectNumber: r.projectNumber,
    title: r.title,
    status: r.status,
    company: r.company,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    revenue: r.margin.plannedRevenue,
    cost: r.margin.cost,
    margin: r.margin.plannedMargin,
    marginPct: r.margin.plannedMarginPct,
  }));

  const companies = new Set(projectRows.map((r) => r.company)).size;

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-900 m-0">Financial health</h1>

      {/* hero */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#EEF6EC] rounded-[14px] p-4 col-span-2 md:col-span-1" style={{ border: "1px solid #BCDCB2" }}>
          <div className="font-mono text-[9px] font-bold uppercase text-ink-400 mb-1.5">{"// OVERALL MARGIN"}</div>
          <div className="text-[24px] font-bold rd-tabular text-emerald-700">{fmt(totals.margin)}</div>
          <div className="text-[11px] text-ink-500">{totals.marginPct.toFixed(1)}% on {fmt(totals.revenue)}</div>
        </div>
        <HeroCard label="// REVENUE" v={fmt(totals.revenue)} />
        <HeroCard label="// COST" v={fmt(totals.cost)} accent />
        <HeroCard label="// PASSTHROUGH" v={fmt(totals.passthrough)} />
        <HeroCard label="// PORTFOLIO" v={`${companies} cos · ${totals.count} prj`} />
      </div>

      {/* by individual */}
      <section>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// BY INDIVIDUAL (BD owner)"}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {owners.map((o) => {
            const m = o.revenue - o.cost;
            return (
              <div key={o.name} className="bg-card-rd rounded-[12px] p-3" style={{ border: "1px solid var(--color-hairline)" }}>
                <div className="font-semibold text-[13px]">{o.name} <span className="text-ink-400 font-normal text-[11px]">· {o.count} prj</span></div>
                <div className="flex justify-between text-[12px] text-ink-500 mt-1">
                  <span>Rev / Cost</span><span className="rd-tabular">{fmt(o.revenue)} / {fmt(o.cost)}</span>
                </div>
                <div className="flex justify-between text-[12px] mt-0.5">
                  <span className="text-ink-500">Margin</span>
                  <span className="rd-tabular font-semibold text-emerald-700">{fmt(m)} · {o.revenue > 0 ? ((m / o.revenue) * 100).toFixed(1) : "0.0"}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* by company / table */}
      <section>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// PROJECTS — click a project to log costs"}</p>
        <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
          {rows.length === 0 ? (
            <p className="text-[13px] text-ink-500">No USD projects with an approved estimate yet.</p>
          ) : (
            <FinancialsTable rows={rows} sym={sym} />
          )}
        </div>
      </section>
    </div>
  );
}

function HeroCard({ label, v, accent }: { label: string; v: string; accent?: boolean }) {
  return (
    <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
      <div className="font-mono text-[9px] font-bold uppercase text-ink-400 mb-1.5">{label}</div>
      <div className={`text-[20px] font-bold rd-tabular ${accent ? "text-accent-rd" : "text-ink-900"}`}>{v}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/financials/page.tsx"
git commit -m "feat(financials): company dashboard page"
```

---

### Task 12: Sidebar nav item

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Financials to `MAIN_NAV`**

In the `MAIN_NAV` array, after the Invoices entry add:
```ts
  { href: "/financials", label: "Financials", icon: "⊞", roles: ["ADMIN", "MANAGER"] },
```

- [ ] **Step 2: Verify active-state matching**

`isActive("/financials")` uses `pathname?.startsWith("/financials")` — already correct for the detail route too. No change needed.

- [ ] **Step 3: Type-check + manual check**

Run: `npx tsc --noEmit` (expect no errors). Start dev, confirm Financials appears for ADMIN/MANAGER and is hidden for VIEWER.

- [ ] **Step 4: Commit**
```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(financials): add Financials sidebar nav item"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: all margin tests pass.

- [ ] **Lint the new files**

Run: `npx eslint src/lib/margin.ts src/lib/financials.ts "src/app/(dashboard)/financials" "src/app/api/projects/[id]/costs/route.ts" "src/app/api/projects/[id]/revenue-passthrough/route.ts" src/components/financials`
Expected: exit 0.

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Manual end-to-end (dev server)**

1. `/financials` lists USD projects with approved estimates; overall margin + by-owner + by-company expand all render.
2. Set a BD owner on a project detail page → it appears under that owner in the by-individual rollup.
3. Add/edit/remove cost lines (HRS and FLAT), Save → margin recomputes on `/financials`.
4. An INCENTIVES line shows as passthrough and is excluded from net revenue & margin.
5. VIEWER cannot see the nav item and is redirected from `/financials`.

---

## Spec coverage check

- Cost ledger (customizable, HRS/FLAT, add extras) → Tasks 1, 4, 6.
- Planned + delivered margin → Task 3 (`computeProjectMargin`), surfaced in Tasks 9, 11.
- Incentives passthrough (tag + override) → Tasks 1, 3, 7 (toggle API), 9 (display).
- Sidebar Financials dashboard, dashboard feel → Tasks 10, 11, 12.
- Overall company margin → Task 11 hero.
- By-company expandable → Task 10.
- By-individual / BD field → Tasks 1, 5, 7, 11.
- USD-only company rollup → Task 8 (`usdOnly`), Task 11.
- ADMIN/MANAGER access → Tasks 4, 5, 7, 9, 11, 12.
- Tests (vitest, margin) → Tasks 2, 3.
- Client-PDF safety → new fields unreferenced by PDF renderers (verify in final manual check; no task needed).

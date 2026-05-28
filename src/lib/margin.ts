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

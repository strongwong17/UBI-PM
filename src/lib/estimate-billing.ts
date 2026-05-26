import { resolveLineTotal, type BillingPhase, type QuantitySelector } from "@/lib/estimate-totals";

/** Minimal shape we need off a Prisma estimate's phases/lineItems. */
interface EstimateLineLike {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
}
interface EstimatePhaseLike {
  name: string;
  lineItems: EstimateLineLike[];
}
export interface EstimateForBilling {
  phases: EstimatePhaseLike[];
}

/** Map a Prisma estimate into shared BillingPhase[], resolving the LINE_ITEM
 *  reference from description (basisLineItemDesc) to the target line's id. */
export function mapEstimateToBillingPhases(estimate: EstimateForBilling): BillingPhase[] {
  const idByDesc = new Map<string, string>();
  for (const p of estimate.phases) {
    for (const li of p.lineItems) {
      if (!idByDesc.has(li.description)) idByDesc.set(li.description, li.id);
    }
  }
  return estimate.phases.map((p) => ({
    name: p.name,
    lines: p.lineItems.map((li) => ({
      id: li.id,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      deliveredQuantity: li.deliveredQuantity,
      percentageBasis: li.percentageBasis || null,
      percentageRate: li.percentageRate,
      basisPhaseName: li.basisPhaseName,
      basisLineItemId:
        li.percentageBasis === "LINE_ITEM" && li.basisLineItemDesc
          ? idByDesc.get(li.basisLineItemDesc) ?? null
          : null,
    })),
  }));
}

/** Sum of resolved line totals for an estimate, under the given quantity selector. */
export function estimateSubtotal(estimate: EstimateForBilling, getQty: QuantitySelector): number {
  const phases = mapEstimateToBillingPhases(estimate);
  return phases.reduce(
    (s, ph) => s + ph.lines.reduce((ss, l) => ss + resolveLineTotal(l, phases, getQty), 0),
    0
  );
}

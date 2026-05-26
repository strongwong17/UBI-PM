// Pure, client+server-safe resolution of estimate/invoice line totals,
// including percentage-basis lines. Mirrors the original resolveItemTotal
// from estimate-builder.tsx, generalized over a quantity selector and an
// id-based LINE_ITEM reference.

export interface BillingLine {
  id: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity?: number | null;
  /** "" | null = fixed; otherwise "SUBTOTAL" | "PHASE" | "LINE_ITEM" */
  percentageBasis?: string | null;
  percentageRate?: number | null;
  basisPhaseName?: string | null;
  /** Normalized reference to another BillingLine.id (for LINE_ITEM basis). */
  basisLineItemId?: string | null;
}

export interface BillingPhase {
  name: string;
  lines: BillingLine[];
}

export type QuantitySelector = (line: BillingLine) => number;

export const plannedQty: QuantitySelector = (l) => l.quantity;
export const deliveredQty: QuantitySelector = (l) => l.deliveredQuantity ?? 0;

/**
 * Resolve the total for a single line, handling percentage mode.
 *  - SUBTOTAL: rate × (all fixed + resolved PHASE/LINE_ITEM lines), excluding other SUBTOTAL lines.
 *  - PHASE: rate × (fixed + PHASE/LINE_ITEM lines within the named phase), excluding SUBTOTAL lines.
 *  - LINE_ITEM: rate × (resolved value of the referenced line).
 */
export function resolveLineTotal(
  line: BillingLine,
  phases: BillingPhase[],
  getQty: QuantitySelector
): number {
  if (!line.percentageBasis) return getQty(line) * line.unitPrice;

  const rate = (line.percentageRate || 0) / 100;

  if (line.percentageBasis === "SUBTOTAL") {
    let basis = 0;
    for (const p of phases) {
      for (const item of p.lines) {
        if (item.id === line.id) continue;
        if (!item.percentageBasis) {
          basis += getQty(item) * item.unitPrice;
        } else if (item.percentageBasis !== "SUBTOTAL") {
          basis += resolveLineTotal(item, phases, getQty);
        }
      }
    }
    return basis * rate;
  }

  if (line.percentageBasis === "PHASE") {
    const target = phases.find(
      (p) => p.name.trim() !== "" && p.name.trim() === (line.basisPhaseName ?? "").trim()
    );
    if (!target) return 0;
    let basis = 0;
    for (const item of target.lines) {
      if (item.id === line.id) continue;
      if (!item.percentageBasis) {
        basis += getQty(item) * item.unitPrice;
      } else if (item.percentageBasis !== "SUBTOTAL") {
        basis += resolveLineTotal(item, phases, getQty);
      }
    }
    return basis * rate;
  }

  if (line.percentageBasis === "LINE_ITEM") {
    for (const p of phases) {
      const target = p.lines.find((item) => item.id === line.basisLineItemId);
      if (target) {
        const basis = !target.percentageBasis
          ? getQty(target) * target.unitPrice
          : resolveLineTotal(target, phases, getQty);
        return basis * rate;
      }
    }
    return 0;
  }

  return 0;
}

export function phaseTotal(
  phase: BillingPhase,
  phases: BillingPhase[],
  getQty: QuantitySelector
): number {
  return phase.lines.reduce((sum, l) => sum + resolveLineTotal(l, phases, getQty), 0);
}

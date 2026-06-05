import { resolveLineTotal, deliveredQty } from "@/lib/estimate-totals";
import { mapEstimateToBillingPhases } from "@/lib/estimate-billing";

interface EstLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
  isDiscount: boolean;
}
interface EstPhase {
  name: string;
  lineItems: EstLine[];
}
export interface EstimateForInvoice {
  phases: EstPhase[];
  taxRate: number;
  discount: number;
}

export interface BuiltInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
  estimateLineItemId: string | null;
}
export interface BuiltInvoice {
  lineItems: BuiltInvoiceLine[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
}

/**
 * Build invoice line items + totals from an estimate, billing measured lines at
 * their confirmed deliveredQuantity and emitting percentage lines at their
 * resolved value (off the delivered bases). Lines resolving to exactly 0 are skipped; negative discount lines are kept.
 */
export function buildInvoiceFromEstimate(
  estimate: EstimateForInvoice,
  opts?: { taxRate?: number; discount?: number }
): BuiltInvoice {
  const phases = mapEstimateToBillingPhases(estimate);
  const lineItems: BuiltInvoiceLine[] = [];
  let sortOrder = 0;

  for (let pi = 0; pi < estimate.phases.length; pi++) {
    const srcPhase = estimate.phases[pi];
    const bPhase = phases[pi];
    for (let li = 0; li < srcPhase.lineItems.length; li++) {
      const src = srcPhase.lineItems[li];
      const bLine = bPhase.lines[li];
      const total = resolveLineTotal(bLine, phases, deliveredQty);
      if (total === 0) continue;
      if (src.percentageBasis || src.isDiscount) {
        lineItems.push({
          description: src.description,
          quantity: 1,
          unitPrice: total,
          total,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      } else {
        lineItems.push({
          description: src.description,
          quantity: src.deliveredQuantity ?? 0,
          unitPrice: src.unitPrice,
          total,
          sortOrder: sortOrder++,
          estimateLineItemId: src.id,
        });
      }
    }
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
  const taxRate = opts?.taxRate ?? estimate.taxRate;
  const discount = opts?.discount ?? estimate.discount;
  const taxable = subtotal - discount;
  const tax = taxable * (taxRate / 100);
  const total = taxable + tax;

  return { lineItems, subtotal, taxRate, tax, discount, total };
}

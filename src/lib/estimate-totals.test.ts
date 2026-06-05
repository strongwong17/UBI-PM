import { describe, it, expect } from "vitest";
import { resolveLineTotal, plannedQty, deliveredQty, type BillingPhase } from "@/lib/estimate-totals";

function phases(lines: BillingPhase["lines"], name = "P1"): BillingPhase[] {
  return [{ name, lines }];
}

describe("resolveLineTotal — discounts", () => {
  it("fixed discount resolves to its (negative) unitPrice under planned qty", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -500, percentageBasis: null, isDiscount: true };
    expect(resolveLineTotal(disc, phases([disc]), plannedQty)).toBe(-500);
  });

  it("fixed discount bills in full under delivered qty even with null deliveredQuantity", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -500, deliveredQuantity: null, percentageBasis: null, isDiscount: true };
    expect(resolveLineTotal(disc, phases([disc]), deliveredQty)).toBe(-500);
  });

  it("percentage discount (negative rate) resolves off non-discount lines", () => {
    const work = { id: "w", quantity: 1, unitPrice: 1000, percentageBasis: null };
    const disc = { id: "d", quantity: 1, unitPrice: 0, percentageBasis: "SUBTOTAL", percentageRate: -10, isDiscount: true };
    const ph = phases([work, disc]);
    expect(resolveLineTotal(disc, ph, plannedQty)).toBe(-100);
  });

  it("basis-exclusion: a % fee ignores sibling discount lines", () => {
    const work = { id: "w", quantity: 1, unitPrice: 1000, percentageBasis: null };
    const fee = { id: "f", quantity: 1, unitPrice: 0, percentageBasis: "SUBTOTAL", percentageRate: 15 };
    const disc = { id: "d", quantity: 1, unitPrice: -200, percentageBasis: null, isDiscount: true };
    const ph = phases([work, fee, disc]);
    expect(resolveLineTotal(fee, ph, plannedQty)).toBe(150); // 15% of 1000, NOT of 800
  });

  it("LINE_ITEM percentage cannot reference a discount row (resolves 0)", () => {
    const disc = { id: "d", quantity: 1, unitPrice: -200, percentageBasis: null, isDiscount: true };
    const pct = { id: "p", quantity: 1, unitPrice: 0, percentageBasis: "LINE_ITEM", percentageRate: 50, basisLineItemId: "d" };
    const ph = phases([disc, pct]);
    expect(resolveLineTotal(pct, ph, plannedQty)).toBe(0);
  });

  it("basis-exclusion applies to PHASE-basis fees too", () => {
    const work = { id: "w", quantity: 1, unitPrice: 1000, percentageBasis: null };
    const fee = { id: "f", quantity: 1, unitPrice: 0, percentageBasis: "PHASE", percentageRate: 15, basisPhaseName: "P1" };
    const disc = { id: "d", quantity: 1, unitPrice: -200, percentageBasis: null, isDiscount: true };
    const ph = phases([work, fee, disc], "P1");
    expect(resolveLineTotal(fee, ph, plannedQty)).toBe(150);
  });

  it("fixed discount ignores quantity (bills its full unitPrice)", () => {
    const disc = { id: "d", quantity: 3, unitPrice: -500, percentageBasis: null, isDiscount: true };
    expect(resolveLineTotal(disc, phases([disc]), plannedQty)).toBe(-500);
  });
});

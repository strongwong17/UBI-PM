import { describe, it, expect } from "vitest";
import { buildInvoiceFromEstimate } from "@/lib/invoice-from-estimate";

const base = {
  description: "x", quantity: 1, unitPrice: 0, deliveredQuantity: null,
  percentageBasis: null, percentageRate: null, basisPhaseName: null,
  basisLineItemDesc: null, isDiscount: false,
};

describe("buildInvoiceFromEstimate — discounts", () => {
  it("includes a fixed discount at qty 1, full magnitude, even when work delivers short", () => {
    const est = {
      taxRate: 0,
      discount: 0,
      phases: [
        {
          name: "P1",
          lineItems: [
            { ...base, id: "w", description: "Work", quantity: 10, unitPrice: 100, deliveredQuantity: 4 },
            { ...base, id: "d", description: "Discount", quantity: 1, unitPrice: -150, isDiscount: true },
          ],
        },
      ],
    };
    const inv = buildInvoiceFromEstimate(est);
    const disc = inv.lineItems.find((l) => l.description === "Discount");
    expect(disc).toBeTruthy();
    expect(disc!.quantity).toBe(1);
    expect(disc!.unitPrice).toBe(-150);
    expect(disc!.total).toBe(-150);
    // subtotal = 4*100 - 150 = 250
    expect(inv.subtotal).toBe(250);
  });
});

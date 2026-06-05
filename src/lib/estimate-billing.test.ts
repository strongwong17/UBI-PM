import { describe, it, expect } from "vitest";
import { mapEstimateToBillingPhases } from "@/lib/estimate-billing";

describe("mapEstimateToBillingPhases", () => {
  it("carries isDiscount onto the billing line", () => {
    const est = {
      phases: [
        {
          name: "P1",
          lineItems: [
            {
              id: "d", description: "Discount", quantity: 1, unitPrice: -500,
              deliveredQuantity: null, percentageBasis: null, percentageRate: null,
              basisPhaseName: null, basisLineItemDesc: null, isDiscount: true,
            },
          ],
        },
      ],
    };
    const out = mapEstimateToBillingPhases(est);
    expect(out[0].lines[0].isDiscount).toBe(true);
  });
});

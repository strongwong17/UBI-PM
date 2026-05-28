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
    expect(estimateNetRevenue(estimate, (l) => l.quantity)).toBe(10000);
  });
  it("uses delivered quantities", () => {
    expect(estimateNetRevenue(estimate, (l) => l.deliveredQuantity ?? 0)).toBe(9700);
  });
  it("sums passthrough separately", () => {
    expect(estimatePassthrough(estimate, (l) => l.quantity)).toBe(7000);
  });
});

describe("computeProjectMargin", () => {
  it("nets cost against planned & delivered revenue, excludes passthrough", () => {
    const m = computeProjectMargin({
      estimates: [estimate],
      costLineItems: [
        { costType: "HOURS", hours: 60, rate: 40, amount: null },
        { costType: "FLAT", hours: null, rate: null, amount: 1600 },
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

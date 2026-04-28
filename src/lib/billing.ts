// src/lib/billing.ts
import type { Prisma } from "@/generated/prisma/client";

export type ProjectForBilling = Prisma.ProjectGetPayload<{
  include: {
    estimates: {
      include: { phases: { include: { lineItems: true } } };
    };
    invoices: true;
  };
}>;

export interface BillingState {
  estimated: number;
  delivered: number;
  invoiced: number;
  paid: number;
  primaryCurrency: string;
  otherCurrencyTotals: { currency: string; invoiced: number }[];
}

export function computeBillingState(project: ProjectForBilling): BillingState {
  const primaryCurrency =
    project.estimates.find((e) => e.isApproved && !e.parentEstimateId)?.currency || "USD";

  let estimated = 0;
  let delivered = 0;

  for (const est of project.estimates) {
    if (!est.isApproved) continue;
    if (est.parentEstimateId) continue; // skip RMB duplicates
    if (est.currency !== primaryCurrency) continue;
    for (const phase of est.phases) {
      for (const li of phase.lineItems) {
        estimated += li.quantity * li.unitPrice;
        delivered += (li.deliveredQuantity ?? 0) * li.unitPrice;
      }
    }
  }

  let invoiced = 0;
  let paid = 0;
  const otherCurrencyMap = new Map<string, number>();

  for (const inv of project.invoices) {
    if (inv.deletedAt) continue;
    if (inv.currency === primaryCurrency) {
      invoiced += inv.total;
      if (inv.status === "PAID") paid += inv.total;
    } else {
      otherCurrencyMap.set(inv.currency, (otherCurrencyMap.get(inv.currency) ?? 0) + inv.total);
    }
  }

  const otherCurrencyTotals = Array.from(otherCurrencyMap.entries()).map(
    ([currency, invoicedAmt]) => ({ currency, invoiced: invoicedAmt })
  );

  return { estimated, delivered, invoiced, paid, primaryCurrency, otherCurrencyTotals };
}

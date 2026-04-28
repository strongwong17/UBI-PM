// src/components/invoices/billing-meter.tsx
"use client";

import type { BillingState } from "@/lib/billing";

interface Props {
  state: BillingState;
  showNewInvoiceButton?: boolean;
  onNewInvoice?: () => void;
}

function fmt(n: number, currency: string) {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BillingMeter({ state, showNewInvoiceButton, onNewInvoice }: Props) {
  const { estimated, delivered, invoiced, paid, primaryCurrency, otherCurrencyTotals } = state;
  const invoicedPct = estimated > 0 ? Math.min(100, Math.round((invoiced / estimated) * 100)) : 0;

  return (
    <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-4">
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Estimated</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(estimated, primaryCurrency)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Delivered</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(delivered, primaryCurrency)}</div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            Invoiced {invoicedPct > 0 && (
              <span className="ml-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                {invoicedPct}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${invoicedPct}%` }} />
            </div>
            <strong className="text-sm tabular-nums">{fmt(invoiced, primaryCurrency)}</strong>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Paid</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{fmt(paid, primaryCurrency)}</div>
        </div>
        {showNewInvoiceButton && (
          <button
            type="button"
            onClick={onNewInvoice}
            className="ml-auto rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            + New Invoice
          </button>
        )}
      </div>
      {otherCurrencyTotals.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {otherCurrencyTotals.map((t) => `+ ${fmt(t.invoiced, t.currency)} invoiced in ${t.currency}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

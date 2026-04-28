// src/components/invoices/invoices-tab.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { BillingMeter } from "@/components/invoices/billing-meter";
import { NewInvoiceSheet, type SheetEstimate } from "@/components/invoices/new-invoice-sheet";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";
import type { BillingState } from "@/lib/billing";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: string | null;
  paidDate: string | null;
  exchangeRate: number | null;
  parentInvoiceId: string | null;
  rmbDuplicate: { id: string; invoiceNumber: string } | null;
  estimate: { estimateNumber: string; label: string | null; version: number } | null;
  lineCount: number;
}

interface Props {
  projectId: string;
  billing: BillingState;
  invoices: InvoiceRow[];
  estimatesForSheet: SheetEstimate[];
}

export function InvoicesTab({ projectId, billing, invoices, estimatesForSheet }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const canCreate = estimatesForSheet.length > 0;
  const uninvoicedRemaining = billing.delivered - billing.invoiced;

  return (
    <div className="space-y-4">
      <BillingMeter
        state={billing}
        showNewInvoiceButton={canCreate}
        onNewInvoice={() => setSheetOpen(true)}
      />

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-gray-500">No invoices yet.</p>
            {canCreate ? (
              <Button onClick={() => setSheetOpen(true)} size="sm">+ New Invoice</Button>
            ) : (
              <p className="text-sm text-gray-400">Approve an estimate to enable invoicing.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className={invoice.parentInvoiceId ? "border-amber-300 bg-amber-50/30" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{invoice.invoiceNumber}</CardTitle>
                      {invoice.parentInvoiceId && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">RMB Duplicate</Badge>
                      )}
                      {invoice.currency !== "USD" && (
                        <Badge variant="outline" className="text-xs">{invoice.currency}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Total: {invoice.currency === "CNY" ? "¥" : "$"}{invoice.total.toLocaleString()}
                    </p>
                    {invoice.estimate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        From: {invoice.estimate.estimateNumber} v{invoice.estimate.version}
                        {invoice.estimate.label ? ` — ${invoice.estimate.label}` : ""}
                        {" · "}{invoice.lineCount} line{invoice.lineCount === 1 ? "" : "s"}
                      </p>
                    )}
                    {invoice.exchangeRate && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Exchange rate: 1 USD = {invoice.exchangeRate} CNY
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={invoice.status} />
                    <InvoiceStatusChanger invoiceId={invoice.id} currentStatus={invoice.status} />
                    {!invoice.parentInvoiceId && (
                      <CreateRmbInvoiceButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        hasRmbDuplicate={!!invoice.rmbDuplicate}
                      />
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/invoices/${invoice.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank">PDF</a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {invoice.dueDate || invoice.paidDate ? (
                <CardContent className="text-sm text-gray-500 pt-0">
                  {invoice.dueDate && <p>Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
                  {invoice.paidDate && <p className="text-emerald-700">Paid: {new Date(invoice.paidDate).toLocaleDateString()}</p>}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {uninvoicedRemaining > 0 && billing.invoiced > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          💡 <strong>{billing.primaryCurrency === "CNY" ? "¥" : "$"}{uninvoicedRemaining.toLocaleString()}</strong> still uninvoiced — create another invoice to bill the remainder.
        </div>
      )}

      <NewInvoiceSheet
        projectId={projectId}
        estimates={estimatesForSheet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

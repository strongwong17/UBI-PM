import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currencySymbol } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, User, FolderKanban, Mail, Download, ArrowRight } from "lucide-react";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";
import { InvoiceLineEditor } from "@/components/invoices/invoice-line-editor";
import { Badge } from "@/components/ui/badge";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      rmbDuplicate: { select: { id: true, invoiceNumber: true } },
      parentInvoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  if (!invoice) notFound();

  const sym = currencySymbol(invoice.currency);
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isDraft = invoice.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              {invoice.parentInvoiceId && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  RMB Duplicate
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={invoice.status} />
              {invoice.currency !== "USD" && (
                <Badge variant="outline">{invoice.currency}</Badge>
              )}
              {isDraft && (
                <span className="text-xs text-blue-600 font-medium">Editable</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusChanger invoiceId={invoice.id} currentStatus={invoice.status} />
          {!invoice.parentInvoiceId && (
            <CreateRmbInvoiceButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              hasRmbDuplicate={!!invoice.rmbDuplicate}
            />
          )}
          <a href={`/api/invoices/${invoice.id}/pdf`} download>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                {isDraft && (
                  <span className="text-xs text-gray-500">Adjust quantities and discount before sending</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isDraft ? (
                <InvoiceLineEditor
                  invoiceId={invoice.id}
                  lineItems={invoice.lineItems.map((li) => ({
                    id: li.id,
                    description: li.description,
                    quantity: li.quantity,
                    unitPrice: li.unitPrice,
                    total: li.total,
                    sortOrder: li.sortOrder,
                  }))}
                  discount={invoice.discount}
                  taxRate={invoice.taxRate}
                  currencySymbol={sym}
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.description}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">{sym}{fmt(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {sym}{fmt(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="max-w-xs ml-auto space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">{sym}{fmt(invoice.subtotal)}</span>
                      </div>
                      {invoice.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Discount</span>
                          <span className="font-medium text-red-600">-{sym}{fmt(invoice.discount)}</span>
                        </div>
                      )}
                      {invoice.taxRate > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tax ({invoice.taxRate}%)</span>
                          <span className="font-medium">{sym}{fmt(invoice.tax)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-xl">{sym}{fmt(invoice.total)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {invoice.notes && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-500 mb-2">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <Link
                    href={`/clients/${invoice.project.client.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {invoice.project.client.company}
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FolderKanban className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Project</p>
                  <Link
                    href={`/projects/${invoice.project.id}?tab=invoice`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {invoice.project.projectNumber}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{invoice.project.title}</p>
                </div>
              </div>

              {invoice.contactEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Contact Email</p>
                    <a
                      href={`mailto:${invoice.contactEmail}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {invoice.contactEmail}
                    </a>
                  </div>
                </div>
              )}

              {invoice.issuedDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Issued</p>
                    <p className="text-sm">{new Date(invoice.issuedDate).toLocaleDateString()}</p>
                  </div>
                </div>
              )}

              {invoice.dueDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Due</p>
                    <p className="text-sm font-medium">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {invoice.paidDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="text-sm font-medium text-green-700">
                      {new Date(invoice.paidDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {invoice.exchangeRate && (
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Exchange Rate</p>
                    <p className="text-sm font-medium">1 USD = {invoice.exchangeRate} CNY</p>
                  </div>
                </div>
              )}

              {invoice.parentInvoice && (
                <div className="flex items-start gap-3">
                  <FolderKanban className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Original Invoice</p>
                    <Link
                      href={`/invoices/${invoice.parentInvoice.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {invoice.parentInvoice.invoiceNumber}
                    </Link>
                  </div>
                </div>
              )}

              {invoice.rmbDuplicate && (
                <div className="flex items-start gap-3">
                  <FolderKanban className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">RMB Duplicate</p>
                    <Link
                      href={`/invoices/${invoice.rmbDuplicate.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {invoice.rmbDuplicate.invoiceNumber}
                    </Link>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

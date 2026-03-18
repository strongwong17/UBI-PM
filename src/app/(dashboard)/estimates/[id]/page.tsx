import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Edit, Calendar, User, Download, FileSpreadsheet } from "lucide-react";
import { EstimateStatusChanger } from "@/components/estimates/estimate-status-changer";
import { EstimateDuplicateButton } from "@/components/estimates/estimate-duplicate-button";
import { EstimateApproveButton } from "@/components/estimates/estimate-approve-button";
import { EstimateDeleteButton } from "@/components/estimates/estimate-delete-button";
import { CreateRmbEstimateButton } from "@/components/estimates/create-rmb-estimate-button";
import { currencySymbol } from "@/lib/currency";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } },
      createdBy: { select: { name: true } },
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
      rmbDuplicate: { select: { id: true, estimateNumber: true } },
      parentEstimate: { select: { id: true, estimateNumber: true } },
    },
  });

  if (!estimate) notFound();

  const symbol = currencySymbol(estimate.currency);

  const subtotal = estimate.phases.reduce(
    (sum, phase) =>
      sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
    0
  );
  const taxAmount = subtotal * (estimate.taxRate / 100);
  const total = subtotal + taxAmount - estimate.discount;

  const fmt = (n: number) =>
    n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${estimate.project.id}?tab=estimates`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
              <Link href={`/clients/${estimate.project.client.id}`} className="hover:text-blue-600 hover:underline">
                {estimate.project.client.company}
              </Link>
              <span>/</span>
              <Link href={`/projects/${estimate.project.id}`} className="hover:text-blue-600 hover:underline">
                {estimate.project.title}
              </Link>
              <span>/</span>
              <span className="text-gray-700 font-medium">{estimate.estimateNumber}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{estimate.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={estimate.status} />
              <Badge variant="outline">{estimate.estimateNumber}</Badge>
              {estimate.label && (
                <Badge variant="secondary">{estimate.label}</Badge>
              )}
              {estimate.isApproved && (
                <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>
              )}
              {estimate.parentEstimateId && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">RMB Version</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <EstimateStatusChanger estimateId={estimate.id} currentStatus={estimate.status} />
          <EstimateApproveButton
            estimateId={estimate.id}
            isApproved={estimate.isApproved}
            version={estimate.version}
          />
          <EstimateDuplicateButton estimateId={estimate.id} />
          {!estimate.parentEstimateId && (
            <CreateRmbEstimateButton
              estimateId={estimate.id}
              estimateNumber={estimate.estimateNumber}
              hasRmbDuplicate={!!estimate.rmbDuplicate}
            />
          )}
          <a href={`/api/estimates/${estimate.id}/pdf`} download>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </a>
          <a href={`/api/estimates/${estimate.id}/excel`} download>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </a>
          <Link href={`/estimates/${estimate.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <EstimateDeleteButton
            estimateId={estimate.id}
            estimateTitle={estimate.title}
            redirectTo={`/projects/${estimate.project.id}?tab=estimates`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phases & Line Items */}
        <div className="lg:col-span-2 space-y-4">
          {estimate.phases.map((phase) => {
            const phaseTotal = phase.lineItems.reduce(
              (sum, li) => sum + li.quantity * li.unitPrice,
              0
            );
            return (
              <Card key={phase.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{phase.name}</CardTitle>
                      {phase.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{phase.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {symbol} {fmt(phaseTotal)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phase.lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{item.description}</p>
                              {item.notes && (
                                <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{item.unit}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">
                            {symbol} {fmt(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {symbol} {fmt(item.quantity * item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          {/* Totals */}
          <Card>
            <CardContent className="pt-6">
              <div className="max-w-xs ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{symbol} {fmt(subtotal)}</span>
                </div>
                {estimate.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({estimate.taxRate}%)</span>
                    <span className="font-medium">{symbol} {fmt(taxAmount)}</span>
                  </div>
                )}
                {estimate.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-red-600">− {symbol} {fmt(estimate.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-xl">{symbol} {fmt(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <Link
                    href={`/clients/${estimate.project.client.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {estimate.project.client.company}
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Project</p>
                  <Link
                    href={`/projects/${estimate.project.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {estimate.project.title}
                  </Link>
                </div>
              </div>

              {estimate.validUntil && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Valid Until</p>
                    <p className="text-sm font-medium">
                      {new Date(estimate.validUntil).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {estimate.exchangeRate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Exchange Rate</p>
                    <p className="text-sm font-medium">1 USD = {estimate.exchangeRate} CNY</p>
                  </div>
                </div>
              )}

              {estimate.parentEstimate && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Original Estimate</p>
                    <Link
                      href={`/estimates/${estimate.parentEstimate.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {estimate.parentEstimate.estimateNumber}
                    </Link>
                  </div>
                </div>
              )}

              {estimate.rmbDuplicate && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">RMB Version</p>
                    <Link
                      href={`/estimates/${estimate.rmbDuplicate.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {estimate.rmbDuplicate.estimateNumber}
                    </Link>
                  </div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-xs text-gray-500">Created by</p>
                <p className="text-sm">{estimate.createdBy.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Modified</p>
                <p className="text-sm">{new Date(estimate.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{new Date(estimate.createdAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          {(estimate.notes || estimate.clientNotes) && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {estimate.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Internal</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{estimate.notes}</p>
                  </div>
                )}
                {estimate.clientNotes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Client-facing</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{estimate.clientNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectStatusStepper } from "@/components/projects/project-status-stepper";
import { ProjectHubTabs } from "@/components/projects/project-hub-tabs";
import { InquiryBriefForm } from "@/components/projects/inquiry-brief-form";
import { DeliverySignoffTab } from "@/components/projects/delivery-signoff-tab";
import { computeBillingState } from "@/lib/billing";
import { GenerateInvoiceButton } from "@/components/projects/generate-invoice-button";
import { EstimateApproveButton } from "@/components/estimates/estimate-approve-button";
import { EstimateCardActions } from "@/components/estimates/estimate-card-actions";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { CreateRmbInvoiceButton } from "@/components/invoices/create-rmb-invoice-button";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ClientSignalsPanel } from "@/components/projects/client-signals-panel";

import { ArrowLeft, Building2, User, Calendar, Plus } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectHubPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
      primaryContact: true,
      assignedTo: { select: { id: true, name: true } },
      inquiry: { include: { serviceModules: { orderBy: { sortOrder: "asc" } } } },
      estimates: {
        where: { deletedAt: null },
        include: {
          phases: {
            include: { lineItems: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
          createdBy: { select: { name: true } },
          rmbDuplicate: { select: { id: true, estimateNumber: true } },
        },
        orderBy: { version: "asc" },
      },
      invoices: {
        where: { deletedAt: null },
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
          estimate: { select: { estimateNumber: true, label: true, version: true } },
          rmbDuplicate: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      completion: { include: { internalCompletedBy: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const approvedEstimates = project.estimates.filter((e) => e.isApproved);

  // Build approved estimates list with hasInvoice flag
  const invoicedEstimateIds = new Set(
    project.invoices.map((inv) => inv.estimateId).filter(Boolean)
  );
  const approvedForInvoice = approvedEstimates.map((e) => ({
    id: e.id,
    estimateNumber: e.estimateNumber,
    version: e.version,
    label: e.label ?? null,
    hasInvoice: invoicedEstimateIds.has(e.id),
  }));

  const hasUninvoicedApproved = approvedForInvoice.some((e) => !e.hasInvoice);

  function estimateTotal(estimate: NonNullable<typeof project>["estimates"][0]) {
    const subtotal = estimate.phases.reduce(
      (sum, phase) =>
        sum + phase.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0
    );
    const discount = estimate.discount ?? 0;
    const taxRate = estimate.taxRate ?? 0;
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    return taxable + tax;
  }

  // Total of approved estimates only (excluding RMB duplicates to avoid double-counting)
  const approvedTotal = approvedEstimates
    .filter((est) => !est.parentEstimateId)
    .reduce((sum, est) => sum + estimateTotal(est), 0);
  const billing = computeBillingState(project);
  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Tab contents ────────────────────────────────────────────

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/clients/${project.client.id}`}
              className="font-semibold text-blue-600 hover:underline flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              {project.client.company}
            </Link>
            {project.primaryContact && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <User className="h-3 w-3" />
                {project.primaryContact.name}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {project.startDate && (
              <p className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-gray-400" />
                Start: {new Date(project.startDate).toLocaleDateString()}
              </p>
            )}
            {project.endDate && (
              <p className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-gray-400" />
                End: {new Date(project.endDate).toLocaleDateString()}
              </p>
            )}
            {!project.startDate && !project.endDate && (
              <p className="text-gray-400">No dates set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {project.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Client Brief — everything in one section */}
      <ClientSignalsPanel
        projectId={project.id}
        attachments={project.attachments.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        briefForm={
          <>
            <InquiryBriefForm
              projectId={project.id}
              initialData={project.inquiry ? {
                createdAt: project.inquiry.createdAt.toISOString(),
                source: project.inquiry.source,
                sourceDetail: project.inquiry.sourceDetail ?? null,
                durationWeeks: project.inquiry.scope?.replace(/\s*weeks?/i, "") || "",
                timeline: project.inquiry.timeline ?? null,
                serviceModules: project.inquiry.serviceModules.map((m) => ({
                  moduleType: m.moduleType,
                  sortOrder: m.sortOrder,
                })),
              } : undefined}
            />
          </>
        }
      />
    </div>
  );

  const estimatesTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Estimates ({project.estimates.length})</h3>
        <Button asChild variant="outline" size="sm">
          <Link href={`/estimates/new?projectId=${project.id}`}>
            <Plus className="h-4 w-4 mr-2" />
            New Estimate
          </Link>
        </Button>
      </div>
      {project.estimates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No estimates yet. Generate one from the brief or create manually.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {project.estimates.map((estimate) => {
            const total = estimateTotal(estimate);
            return (
              <Card key={estimate.id} className={estimate.isApproved ? "border-green-400" : estimate.parentEstimateId ? "border-amber-300 bg-amber-50/30" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/estimates/${estimate.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {estimate.title}
                      </Link>
                      <Badge variant="outline" className="font-mono text-xs">{estimate.estimateNumber}</Badge>
                      {estimate.label && (
                        <Badge variant="secondary" className="text-xs">{estimate.label}</Badge>
                      )}
                      <StatusBadge status={estimate.status} />
                      {estimate.isApproved && (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Approved
                        </Badge>
                      )}
                      {estimate.parentEstimateId && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                          RMB Version
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {estimate.currency === "CNY" ? "¥" : "$"}{total.toLocaleString()}
                      </span>
                      {!estimate.isApproved && (
                        <EstimateApproveButton
                          estimateId={estimate.id}
                          isApproved={false}
                          version={estimate.version}
                        />
                      )}
                      <EstimateCardActions
                        estimateId={estimate.id}
                        estimateNumber={estimate.estimateNumber}
                        estimateTitle={estimate.title}
                        isApproved={estimate.isApproved}
                        isRmbDuplicate={!!estimate.parentEstimateId}
                        hasRmbDuplicate={!!estimate.rmbDuplicate}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CTA: Proceed to completion when there are approved estimates without invoices */}
      {hasUninvoicedApproved && (
        <Card className="border-green-300 bg-green-50/50">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-green-900">Estimate approved — ready to complete project</p>
              <p className="text-sm text-green-700 mt-0.5">
                Review deliverables, adjust quantities, and generate the final invoice.
              </p>
            </div>
            <Button asChild className="bg-green-600 hover:bg-green-700 shrink-0">
              <Link href={`/projects/${project.id}?tab=completion`}>
                Proceed to Completion
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const invoiceTab = (
    <div className="space-y-4">
      {project.invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-gray-500">No invoices yet.</p>
            {hasUninvoicedApproved ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">Generate invoices through the Completion tab.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${project.id}?tab=completion`}>Go to Completion</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Approve an estimate first, then use the Completion tab to generate invoices.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {project.invoices.map((invoice) => (
            <Card key={invoice.id} className={invoice.parentInvoiceId ? "border-amber-300 bg-amber-50/30" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{invoice.invoiceNumber}</CardTitle>
                      {invoice.parentInvoiceId && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                          RMB Duplicate
                        </Badge>
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
                    <InvoiceStatusChanger
                      invoiceId={invoice.id}
                      currentStatus={invoice.status}
                    />
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
                      <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank">
                        PDF
                      </a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {invoice.lineItems.length > 0 && (
                <CardContent>
                  <div className="space-y-1">
                    {invoice.lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.description}</span>
                        <span className="font-medium">{item.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {invoice.dueDate && (
                    <p className="text-sm text-gray-500 mt-3">
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  )}
                  {invoice.paidDate && (
                    <p className="text-sm text-green-600 mt-1">
                      Paid: {new Date(invoice.paidDate).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const completionTab = (
    <DeliverySignoffTab
      projectId={project.id}
      projectStatus={project.status}
      estimates={approvedEstimates
        .filter((e) => !e.parentEstimateId)
        .map((est) => ({
          id: est.id,
          estimateNumber: est.estimateNumber,
          title: est.title,
          label: est.label ?? null,
          currency: est.currency,
          lines: est.phases.flatMap((p) =>
            p.lineItems.map((l) => ({
              id: l.id,
              description: l.description,
              serviceModuleType: l.serviceModuleType ?? null,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              deliveredQuantity: l.deliveredQuantity ?? null,
            }))
          ),
        }))}
      initialCompletion={
        project.completion
          ? {
              internalCompleted: project.completion.internalCompleted,
              internalCompletedAt: project.completion.internalCompletedAt?.toISOString() ?? null,
              internalCompletedBy: project.completion.internalCompletedBy
                ? { name: project.completion.internalCompletedBy.name }
                : null,
              internalNotes: project.completion.internalNotes,
              clientAcknowledged: project.completion.clientAcknowledged,
              clientAcknowledgedAt: project.completion.clientAcknowledgedAt?.toISOString() ?? null,
              clientAcknowledgedBy: project.completion.clientAcknowledgedBy,
              clientAcknowledgeNotes: project.completion.clientAcknowledgeNotes,
              deliverablesNotes: project.completion.deliverablesNotes,
            }
          : null
      }
      billingSummary={{
        estimated: billing.estimated,
        invoiced: billing.invoiced,
        primaryCurrency: billing.primaryCurrency,
      }}
      hasInvoices={project.invoices.length > 0}
    />
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Projects
          </Link>
        </Button>
      </div>

      {/* Project Title & Meta */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-mono text-gray-400">{project.projectNumber}</span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{project.title}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
              <span>{project.client.company}</span>
              {project.primaryContact && <span>· {project.primaryContact.name}</span>}
              {project.assignedTo && <span>· Assigned: {project.assignedTo.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {approvedEstimates.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Project Total</p>
                <p className="text-xl font-bold tracking-tight text-green-700">
                  ${fmtCurrency(approvedTotal)}
                </p>
                <p className="text-xs text-gray-400">
                  {approvedEstimates.filter((e) => !e.parentEstimateId).length} approved
                </p>
              </div>
            )}
            {isAdmin && (
              <DeleteProjectButton projectId={project.id} projectNumber={project.projectNumber} />
            )}
          </div>
        </div>

        {/* Status Stepper */}
        <div className="pt-2">
          <ProjectStatusStepper
            projectId={project.id}
            currentStatus={project.status}
            context={{
              hasInquiry: !!project.inquiry,
              estimateCount: project.estimates.length,
              approvedEstimateCount: approvedEstimates.length,
              invoiceCount: project.invoices.length,
              hasUninvoicedApproved,
              updatedAt: project.updatedAt.toISOString(),
              startDate: project.startDate?.toISOString() ?? null,
              contactEmail: project.primaryContact?.email ?? null,
              contactName: project.primaryContact?.name ?? null,
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <ProjectHubTabs
        defaultTab="overview"
        tabs={[
          { value: "overview", label: "Overview", content: overviewTab },
          { value: "estimates", label: `Estimates (${project.estimates.length})`, content: estimatesTab },
          { value: "invoice", label: `Invoices (${project.invoices.length})`, content: invoiceTab },
          { value: "completion", label: "Delivery & Sign-off", content: completionTab },
        ]}
      />
    </div>
  );
}

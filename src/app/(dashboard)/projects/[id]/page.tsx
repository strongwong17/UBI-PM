import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/redesign/status-pill";
import { ProjectStatusStepper } from "@/components/projects/project-status-stepper";
import { ProjectHubTabs } from "@/components/projects/project-hub-tabs";
import { InquiryBriefForm } from "@/components/projects/inquiry-brief-form";
import { DeliverySignoffTab } from "@/components/projects/delivery-signoff-tab";
import { computeBillingState } from "@/lib/billing";
import { InvoicesTab } from "@/components/invoices/invoices-tab";
import { EstimateApproveButton } from "@/components/estimates/estimate-approve-button";
import { EstimateCardActions } from "@/components/estimates/estimate-card-actions";

import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ClientSignalsPanel } from "@/components/projects/client-signals-panel";
import { UnderDevButton } from "@/components/redesign/under-dev-button";

import { Building2, User, Calendar, Plus } from "lucide-react";

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
      feedback: { include: { internalSubmittedBy: { select: { name: true } } } },
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

  const approvedForInvoice = approvedEstimates.map((e) => ({
    id: e.id,
    estimateNumber: e.estimateNumber,
    version: e.version,
    label: e.label ?? null,
    currency: e.currency,
    total: estimateTotal(e),
    hasInvoice: invoicedEstimateIds.has(e.id),
    isRmbDuplicate: !!e.parentEstimateId,
  }));

  const hasUninvoicedApproved = approvedForInvoice.some((e) => !e.hasInvoice);

  // Total of approved estimates only (excluding RMB duplicates to avoid double-counting)
  const approvedTotal = approvedEstimates
    .filter((est) => !est.parentEstimateId)
    .reduce((sum, est) => sum + estimateTotal(est), 0);
  const billing = computeBillingState(project);

  const hasApprovedEstimate = approvedEstimates.some((e) => !e.parentEstimateId);

  const invoiceRows = project.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    total: inv.total,
    currency: inv.currency,
    dueDate: inv.dueDate?.toISOString() ?? null,
    paidDate: inv.paidDate?.toISOString() ?? null,
    exchangeRate: inv.exchangeRate ?? null,
    parentInvoiceId: inv.parentInvoiceId ?? null,
    rmbDuplicate: inv.rmbDuplicate ?? null,
    estimate: inv.estimate ?? null,
    lineCount: inv.lineItems.length,
  }));

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
      {/* Section header — same pattern as delivery-signoff */}
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 mb-1 text-ink-500">
            {"// ESTIMATES"}
          </p>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 text-ink-900">
            {project.estimates.length === 0
              ? "No estimates yet"
              : `${project.estimates.length} ${project.estimates.length === 1 ? "estimate" : "estimates"}`}
          </h2>
          <p className="text-[13px] text-ink-500 m-0 mt-1 max-w-[520px]">
            Versioned estimates for this project. Approve one to start work — auto-advances the
            project to In Progress.
          </p>
        </div>
        <Link
          href={`/estimates/new?projectId=${project.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
          style={{
            background: "var(--color-canvas-cool)",
            border: "1px solid var(--color-hairline-strong)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New estimate
        </Link>
      </div>

      {project.estimates.length === 0 ? (
        <div
          className="rounded-[14px] p-8 text-center"
          style={{
            background: "var(--color-card-rd)",
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <p className="text-[13px] text-ink-500 m-0">
            No estimates yet. Generate one from the brief or create manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {project.estimates.map((estimate) => {
            const total = estimateTotal(estimate);
            const isRmb = !!estimate.parentEstimateId;
            const accent = estimate.isApproved
              ? "var(--color-s-delivered)"
              : isRmb
              ? "rgba(217, 119, 6, 0.55)"
              : "var(--color-hairline)";
            return (
              <div
                key={estimate.id}
                className="rounded-[12px] px-4 py-2.5 flex items-center gap-3 flex-wrap"
                style={{
                  background: "var(--color-card-rd)",
                  border: `1px solid ${accent}`,
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: estimate.isApproved ? "var(--color-s-delivered)" : "var(--color-ink-300)" }}
                />
                <span className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-ink-500 flex-shrink-0">
                  {estimate.estimateNumber}·v{estimate.version}
                </span>
                <Link
                  href={`/estimates/${estimate.id}`}
                  className="text-[13px] font-semibold text-ink-900 hover:underline tracking-[-0.005em] min-w-0 truncate"
                >
                  {estimate.title}
                </Link>
                <StatusPill status={estimate.status} size="xs" />
                {estimate.isApproved && <StatusPill status="APPROVED" label="Approved" size="xs" />}
                {estimate.label && (
                  <span
                    className="font-mono text-[10px] tracking-[0.04em] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "var(--color-canvas-cool)",
                      color: "var(--color-ink-500)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    {estimate.label}
                  </span>
                )}
                {isRmb && (
                  <span
                    className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(217, 119, 6, 0.10)", color: "#A85614" }}
                  >
                    RMB
                  </span>
                )}
                <span
                  className="ml-auto font-mono text-[12px] font-bold rd-tabular flex-shrink-0"
                  style={{ color: "var(--color-ink-900)" }}
                >
                  {estimate.currency === "CNY" ? "¥" : "$"}
                  {total.toLocaleString()}
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
                  isRmbDuplicate={isRmb}
                  hasRmbDuplicate={!!estimate.rmbDuplicate}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* CTA — when approved estimates have uninvoiced lines, point to Delivery & Sign-off */}
      {hasUninvoicedApproved && (
        <div
          className="rounded-[14px] p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: "var(--color-s-delivered-bg)",
            border: "1px solid var(--color-s-delivered)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div>
            <p
              className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase m-0 mb-1"
              style={{ color: "var(--color-s-delivered-fg)" }}
            >
              {"// READY FOR DELIVERY"}
            </p>
            <p className="text-[14px] font-semibold m-0 mb-0.5" style={{ color: "var(--color-s-delivered-fg)" }}>
              Estimate approved
            </p>
            <p className="text-[12px] m-0" style={{ color: "var(--color-s-delivered-fg)" }}>
              Record actuals and confirm sign-off. Invoices are created on the Invoices tab.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}?tab=completion`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em]"
            style={{
              background: "var(--color-s-delivered)",
              boxShadow: "0 4px 12px -2px rgba(5, 150, 105, 0.32)",
            }}
          >
            Open Delivery & Sign-off
          </Link>
        </div>
      )}
    </div>
  );

  const invoiceTab = (
    <InvoicesTab
      projectId={project.id}
      billing={billing}
      invoices={invoiceRows}
      hasApprovedEstimate={hasApprovedEstimate}
      pendingEstimates={approvedForInvoice.filter((e) => !e.hasInvoice && !e.isRmbDuplicate)}
    />
  );

  const executionTab = (
    <div className="space-y-4">
      {/* Future: Deliverable & team management — gray placeholder */}
      <div
        className="rounded-2xl p-5 mt-4"
        style={{
          background: "linear-gradient(180deg, #F4F1E8 0%, #EFEAE0 100%)",
          border: "1px dashed var(--color-hairline-strong)",
        }}
      >
        <div className="flex items-center justify-between mb-3.5">
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase m-0">
            {"// DELIVERABLES & TEAM TRACKING"}
          </p>
          <span
            className="font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded-full tracking-[0.06em] uppercase"
            style={{ background: "var(--color-ink-300)" }}
          >
            UNDER DEVELOPMENT
          </span>
        </div>
        <p className="text-[12px] text-ink-500 mb-3 max-w-prose">
          Auto-generate deliverables from the approved estimate&apos;s line items. Assign internal team
          members or external vendors to each deliverable. Track per-line completion through
          Recruitment → Fieldwork → Analysis → Reporting. The summary feeds into Confirm Actuals on
          Stage 3.
        </p>
        <UnderDevButton label="Generate deliverables from estimate" />
      </div>
    </div>
  );

  // Default tab by lifecycle stage
  const stage1 = project.status === "ESTIMATING";
  const stage3 = project.status === "DELIVERED";
  const defaultTab =
    stage3 ? "completion"
    : stage1 ? "estimates"
    : "overview";

  const completionTab = (
    <DeliverySignoffTab
      projectId={project.id}
      projectStatus={project.status}
      estimates={approvedEstimates
        .filter((e) => !e.parentEstimateId)
        .map((est) => {
          const linkedInvoice = project.invoices.find((inv) => inv.estimateId === est.id);
          return {
            id: est.id,
            estimateNumber: est.estimateNumber,
            title: est.title,
            label: est.label ?? null,
            currency: est.currency,
            total: estimateTotal(est),
            invoice: linkedInvoice
              ? {
                  id: linkedInvoice.id,
                  invoiceNumber: linkedInvoice.invoiceNumber,
                  status: linkedInvoice.status,
                }
              : null,
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
          };
        })}
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
      initialFeedback={
        project.feedback
          ? {
              internalContent: project.feedback.internalContent,
              internalSubmittedAt: project.feedback.internalSubmittedAt?.toISOString() ?? null,
              internalSubmittedBy: project.feedback.internalSubmittedBy
                ? { name: project.feedback.internalSubmittedBy.name }
                : null,
              clientContent: project.feedback.clientContent,
              clientSubmittedAt: project.feedback.clientSubmittedAt?.toISOString() ?? null,
              clientSubmittedByName: project.feedback.clientSubmittedByName,
            }
          : null
      }
    />
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Crumbs */}
      <div className="font-mono text-[11px] text-ink-400 mb-3 tracking-[0.02em]">
        <Link href="/projects" className="text-ink-400 hover:text-ink-700 no-underline">Projects</Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <Link href={`/clients/${project.client.id}`} className="text-ink-400 hover:text-ink-700 no-underline">{project.client.company}</Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700 font-semibold">{project.projectNumber}</span>
      </div>

      <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="font-mono text-[11px] font-semibold text-ink-300 tracking-[0.04em]">
              {project.projectNumber}
            </span>
            <StatusPill status={project.status} />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] mb-1.5">{project.title}</h1>
          <p className="text-[13px] text-ink-500">
            {project.client.company}
            {project.startDate ? ` · started ${new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            {project.assignedTo ? ` · ${project.assignedTo.name} lead` : ""}
            {approvedTotal > 0 ? ` · $${approvedTotal.toLocaleString()} approved` : ""}
          </p>
        </div>
        {isAdmin && (
          <DeleteProjectButton projectId={project.id} projectNumber={project.projectNumber} />
        )}
      </div>

      {/* Status Stepper (4-stage card row) */}
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

      {/* Tabs */}
      <ProjectHubTabs
        defaultTab={defaultTab}
        tabs={[
          { value: "overview", label: "Overview", content: overviewTab },
          { value: "estimates", label: `Estimates (${project.estimates.length})`, content: estimatesTab },
          { value: "execution", label: "Execution", content: executionTab },
          { value: "completion", label: "Delivery & Sign-off", content: completionTab },
          { value: "invoice", label: `Invoices (${project.invoices.length})`, content: invoiceTab },
        ]}
      />
    </div>
  );
}

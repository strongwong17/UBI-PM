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
import { ExecutionPhaseSelector } from "@/components/projects/execution-phase-selector";
import { ProjectCompletionForm } from "@/components/projects/project-completion-form";
import { GenerateInvoiceButton } from "@/components/projects/generate-invoice-button";
import { EstimateApproveButton } from "@/components/estimates/estimate-approve-button";
import { EstimateDuplicateButton } from "@/components/estimates/estimate-duplicate-button";
import { EstimateStatusChanger } from "@/components/estimates/estimate-status-changer";
import { EstimateDeleteButton } from "@/components/estimates/estimate-delete-button";
import { InvoiceStatusChanger } from "@/components/invoices/invoice-status-changer";
import { DeleteInquiryButton } from "@/components/projects/delete-inquiry-button";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectAttachments } from "@/components/projects/project-attachments";
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
        },
        orderBy: { version: "asc" },
      },
      invoices: {
        where: { deletedAt: null },
        include: {
          lineItems: { orderBy: { sortOrder: "asc" } },
          estimate: { select: { estimateNumber: true, label: true, version: true } },
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

      {/* Brief / Inquiry */}
      {isAdmin && project.inquiry && (
        <div className="flex justify-end">
          <DeleteInquiryButton projectId={project.id} />
        </div>
      )}
      <InquiryBriefForm
        projectId={project.id}
        initialData={project.inquiry ? {
          createdAt: project.inquiry.createdAt.toISOString(),
          rawContent: project.inquiry.rawContent ?? null,
          source: project.inquiry.source,
          sourceDetail: project.inquiry.sourceDetail ?? null,
          desiredStartDate: project.inquiry.desiredStartDate?.toISOString() ?? null,
          desiredEndDate: project.inquiry.desiredEndDate?.toISOString() ?? null,
          timeline: project.inquiry.timeline ?? null,
          serviceModules: project.inquiry.serviceModules.map((m) => ({
            moduleType: m.moduleType,
            sortOrder: m.sortOrder,
          })),
        } : undefined}
      />

      {/* Attachments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-500">
            Attachments{project.attachments.length > 0 && ` (${project.attachments.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectAttachments
            projectId={project.id}
            attachments={project.attachments.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/estimates/new?projectId=${project.id}`}>
              <Plus className="h-4 w-4 mr-2" />
              New Estimate
            </Link>
          </Button>
          {hasUninvoicedApproved && (
            <GenerateInvoiceButton projectId={project.id} approvedEstimates={approvedForInvoice} />
          )}
        </CardContent>
      </Card>
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
              <Card key={estimate.id} className={estimate.isApproved ? "border-green-400" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
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
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold">
                        {estimate.currency} {total.toLocaleString()}
                      </span>
                      <EstimateStatusChanger
                        estimateId={estimate.id}
                        currentStatus={estimate.status}
                      />
                      <EstimateApproveButton
                        estimateId={estimate.id}
                        isApproved={estimate.isApproved}
                        version={estimate.version}
                      />
                      <EstimateDuplicateButton estimateId={estimate.id} />
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/estimates/${estimate.id}/edit`}>Edit</Link>
                      </Button>
                      <EstimateDeleteButton estimateId={estimate.id} estimateTitle={estimate.title} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const invoiceTab = (
    <div className="space-y-4">
      {hasUninvoicedApproved && (
        <div className="flex justify-end">
          <GenerateInvoiceButton projectId={project.id} approvedEstimates={approvedForInvoice} />
        </div>
      )}
      {project.invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-gray-500">No invoices yet.</p>
            {approvedEstimates.length === 0 && (
              <p className="text-sm text-gray-400">Approve an estimate to generate an invoice.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {project.invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>{invoice.invoiceNumber}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Total: {invoice.total.toLocaleString()}
                    </p>
                    {invoice.estimate && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        From: {invoice.estimate.estimateNumber} v{invoice.estimate.version}
                        {invoice.estimate.label ? ` — ${invoice.estimate.label}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={invoice.status} />
                    <InvoiceStatusChanger
                      invoiceId={invoice.id}
                      currentStatus={invoice.status}
                    />
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

  const executionTab = (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionPhaseSelector
            projectId={project.id}
            currentPhase={project.executionPhase}
            disabled={project.status !== "IN_PROGRESS"}
          />
          {project.status !== "IN_PROGRESS" && (
            <p className="text-sm text-gray-400 mt-3">
              Set project status to &quot;In Progress&quot; to track execution phase.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const completionTab = (
    <ProjectCompletionForm
      projectId={project.id}
      initialData={project.completion ? {
        ...project.completion,
        internalCompletedAt: project.completion.internalCompletedAt?.toISOString() ?? null,
        clientAcknowledgedAt: project.completion.clientAcknowledgedAt?.toISOString() ?? null,
      } : undefined}
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
          {isAdmin && (
            <DeleteProjectButton projectId={project.id} projectNumber={project.projectNumber} />
          )}
        </div>

        {/* Status Stepper */}
        <div className="pt-2">
          <ProjectStatusStepper projectId={project.id} currentStatus={project.status} />
        </div>
      </div>

      {/* Tabs */}
      <ProjectHubTabs
        defaultTab="overview"
        tabs={[
          { value: "overview", label: "Overview", content: overviewTab },
          { value: "estimates", label: `Estimates (${project.estimates.length})`, content: estimatesTab },
          { value: "invoice", label: `Invoices (${project.invoices.length})`, content: invoiceTab },
          { value: "execution", label: "Execution", content: executionTab },
          { value: "completion", label: "Completion", content: completionTab },
        ]}
      />
    </div>
  );
}

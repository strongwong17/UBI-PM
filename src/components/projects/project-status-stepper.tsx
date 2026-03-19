"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Check,
  Zap,
  MessageCircle,
  Plus,
  AlertTriangle,
} from "lucide-react";

const STAGES = [
  { value: "INQUIRY_RECEIVED", label: "Inquiry", number: 1 },
  { value: "ESTIMATE_SENT", label: "Estimate", number: 2 },
  { value: "APPROVED", label: "Approved", number: 3 },
  { value: "IN_PROGRESS", label: "In Progress", number: 4 },
  { value: "COMPLETED", label: "Completed", number: 5 },
  { value: "INVOICED", label: "Invoiced", number: 6 },
  { value: "PAID", label: "Paid", number: 7 },
  { value: "CLOSED", label: "Closed", number: 8 },
];

interface ProjectContext {
  hasInquiry: boolean;
  estimateCount: number;
  approvedEstimateCount: number;
  invoiceCount: number;
  hasUninvoicedApproved: boolean;
  updatedAt: string;
  startDate: string | null;
  contactEmail: string | null;
  contactName: string | null;
}

interface ProjectStatusStepperProps {
  projectId: string;
  currentStatus: string;
  context: ProjectContext;
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function timeAgoText(date: string): string {
  const days = daysSince(date);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// What pending status text to show on the NEXT step
function getNextStepStatus(status: string, ctx: ProjectContext): string {
  switch (status) {
    case "INQUIRY_RECEIVED": return ctx.estimateCount > 0 ? "created" : "pending";
    case "ESTIMATE_SENT": return "awaiting";
    case "APPROVED":
    case "IN_PROGRESS": return "in progress";
    case "COMPLETED": return ctx.hasUninvoicedApproved ? "pending" : "ready";
    case "INVOICED": return "awaiting";
    case "PAID": return "ready";
    default: return "";
  }
}

interface StageInfo {
  nextStep: { description: string; buttonLabel: string; href: string };
  secondaryActions?: { label: string; icon: React.ComponentType<{ className?: string }>; href: string }[];
  stageTitle: string;
  bullets: string[];
  riskDays: number;
}

function getStageInfo(status: string, ctx: ProjectContext, projectId: string): StageInfo {
  switch (status) {
    case "INQUIRY_RECEIVED":
      return {
        nextStep: {
          description: "Create an estimate to move this project forward",
          buttonLabel: "Create Estimate",
          href: `/estimates/new?projectId=${projectId}`,
        },
        secondaryActions: ctx.contactEmail ? [
          { label: "Contact Client", icon: MessageCircle, href: `mailto:${ctx.contactEmail}?subject=${encodeURIComponent(`Re: Project inquiry`)}` },
        ] : [],
        stageTitle: "Inquiry",
        bullets: [
          `Inquiry received ${timeAgoText(ctx.updatedAt)}`,
          ctx.estimateCount === 0 ? "No estimate created" : `${ctx.estimateCount} estimate${ctx.estimateCount > 1 ? "s" : ""} created`,
          ctx.hasInquiry ? "Brief filled in" : "No activity since creation",
        ],
        riskDays: 2,
      };
    case "ESTIMATE_SENT":
      return {
        nextStep: {
          description: "Follow up with client to get the estimate approved",
          buttonLabel: "View Estimates",
          href: `/projects/${projectId}?tab=estimates`,
        },
        secondaryActions: ctx.contactEmail ? [
          { label: "Contact Client", icon: MessageCircle, href: `mailto:${ctx.contactEmail}?subject=${encodeURIComponent(`Re: Project inquiry`)}` },
        ] : [],
        stageTitle: "Estimate Sent",
        bullets: [
          `${ctx.estimateCount} estimate${ctx.estimateCount > 1 ? "s" : ""} sent`,
          `Last updated ${timeAgoText(ctx.updatedAt)}`,
          "Waiting for client approval",
        ],
        riskDays: 3,
      };
    case "APPROVED":
    case "IN_PROGRESS":
      return {
        nextStep: {
          description: "Review deliverables and generate the final invoice",
          buttonLabel: "Complete Project",
          href: `/projects/${projectId}?tab=completion`,
        },
        stageTitle: "In Progress",
        bullets: [
          ctx.startDate ? `Started ${timeAgoText(ctx.startDate)}` : "Start date not set",
          `${ctx.approvedEstimateCount} approved estimate${ctx.approvedEstimateCount > 1 ? "s" : ""}`,
          `Last updated ${timeAgoText(ctx.updatedAt)}`,
        ],
        riskDays: 7,
      };
    case "COMPLETED":
      return {
        nextStep: {
          description: ctx.hasUninvoicedApproved
            ? "Generate the final invoice for this project"
            : "Send the invoice to the client",
          buttonLabel: ctx.hasUninvoicedApproved ? "Generate Invoice" : "View Invoice",
          href: ctx.hasUninvoicedApproved
            ? `/projects/${projectId}?tab=completion`
            : `/projects/${projectId}?tab=invoice`,
        },
        stageTitle: "Completed",
        bullets: [
          `Completed ${timeAgoText(ctx.updatedAt)}`,
          `${ctx.invoiceCount} invoice${ctx.invoiceCount !== 1 ? "s" : ""} generated`,
        ],
        riskDays: 3,
      };
    case "INVOICED":
      return {
        nextStep: {
          description: "Record payment once received from client",
          buttonLabel: "View Invoice",
          href: `/projects/${projectId}?tab=invoice`,
        },
        stageTitle: "Invoiced",
        bullets: [
          `Invoiced ${timeAgoText(ctx.updatedAt)}`,
          "Waiting for payment",
        ],
        riskDays: 14,
      };
    case "PAID":
      return {
        nextStep: {
          description: "Archive this project to keep your workspace clean",
          buttonLabel: "Archive Project",
          href: "#",
        },
        stageTitle: "Paid",
        bullets: [`Payment confirmed ${timeAgoText(ctx.updatedAt)}`],
        riskDays: 0,
      };
    case "CLOSED":
      return {
        nextStep: { description: "", buttonLabel: "", href: "" },
        stageTitle: "Closed",
        bullets: [`Archived ${timeAgoText(ctx.updatedAt)}`],
        riskDays: 0,
      };
    default:
      return {
        nextStep: { description: "", buttonLabel: "", href: "" },
        stageTitle: status,
        bullets: [],
        riskDays: 0,
      };
  }
}

export function ProjectStatusStepper({
  projectId,
  currentStatus,
  context,
}: ProjectStatusStepperProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const currentIndex = STAGES.findIndex((s) => s.value === status);
  const info = getStageInfo(status, context, projectId);
  const inactiveDays = daysSince(context.updatedAt);
  const isAtRisk = info.riskDays > 0 && inactiveDays >= info.riskDays;
  const nextStepStatus = getNextStepStatus(status, context);

  async function doUpdate(value: string) {
    setUpdating(true);
    setConfirmTarget(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus(value);
      toast.success("Status updated");
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  function handleStepClick(value: string) {
    if (value === status || updating) return;
    const targetIndex = STAGES.findIndex((s) => s.value === value);
    if (targetIndex < currentIndex) {
      setConfirmTarget(value);
    } else {
      doUpdate(value);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Stepper ── */}
      <div className="flex items-start w-full overflow-x-auto">
        {STAGES.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;

          return (
            <div key={step.value} className="flex items-start flex-1 min-w-0">
              {/* Step */}
              <button
                onClick={() => handleStepClick(step.value)}
                disabled={updating}
                className="flex flex-col items-center gap-1 px-1 w-full transition-all duration-150 group disabled:cursor-not-allowed"
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-150 border-2",
                    isCompleted
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCurrent
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-white border-gray-200 text-gray-400 group-hover:border-gray-300 group-hover:text-gray-500",
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.number}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[11px] text-center leading-tight whitespace-nowrap",
                    isCurrent ? "font-semibold text-blue-600" : isCompleted ? "font-medium text-gray-600" : "text-gray-400"
                  )}
                >
                  {step.label}
                </span>

                {/* Inline status on next step — attached to the step, not floating */}
                {isNext && nextStepStatus && (
                  <span className="text-[10px] text-gray-400 italic leading-none">
                    {nextStepStatus}
                  </span>
                )}
              </button>

              {/* Connector line */}
              {index < STAGES.length - 1 && (
                <div className="flex items-center flex-1 min-w-[12px] pt-4">
                  <div
                    className={cn(
                      "h-px w-full",
                      isCompleted ? "bg-blue-400" : "bg-gray-200"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Next Step callout ── */}
      {info.nextStep.buttonLabel && status !== "CLOSED" && (
        <div className="border border-amber-200/80 rounded-xl bg-amber-50/50 px-5 py-4">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Zap className="h-3 w-3 text-amber-600" />
            </div>
            <h3 className="text-[13px] font-semibold text-gray-900">Next Step</h3>
          </div>
          <p className="text-[13px] text-gray-600 mb-3 ml-[34px]">
            {info.nextStep.description}
          </p>
          <div className="flex items-center gap-2 ml-[34px]">
            {info.nextStep.href === "#" ? (
              <Button
                size="sm"
                onClick={() => {
                  const nextStage = STAGES[currentIndex + 1];
                  if (nextStage) handleStepClick(nextStage.value);
                }}
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg h-8 text-[12px]"
              >
                {info.nextStep.buttonLabel}
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-lg h-8 text-[12px]">
                <Link href={info.nextStep.href}>{info.nextStep.buttonLabel}</Link>
              </Button>
            )}

            {info.secondaryActions?.map((action) => (
              <Button key={action.label} asChild variant="outline" size="sm" className="rounded-lg h-8 text-[12px]">
                <Link href={action.href}>
                  <action.icon className="h-3.5 w-3.5 mr-1.5" />
                  {action.label}
                </Link>
              </Button>
            ))}

            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" asChild>
              <Link href={`/projects/${projectId}?tab=overview`}>
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── Current Stage panel ── */}
      <div className="border border-gray-200 rounded-xl bg-white px-5 py-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] text-gray-500">Current Stage:</span>
          <span className="text-[14px] font-semibold text-gray-900">{info.stageTitle}</span>
        </div>

        {isAtRisk && (
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-semibold">
              <AlertTriangle className="h-3 w-3" />
              At Risk
            </span>
            <span className="text-[12px] text-gray-500">No activity for {inactiveDays} days</span>
          </div>
        )}

        <ul className="mt-2.5 space-y-1">
          {info.bullets.map((bullet, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-gray-500">
              <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* Backward jump confirmation */}
      {confirmTarget && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-[13px]">
          <span className="text-amber-800">
            Move back to <strong>{STAGES.find((s) => s.value === confirmTarget)?.label}</strong>?
          </span>
          <button
            onClick={() => doUpdate(confirmTarget)}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmTarget(null)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "INQUIRY_RECEIVED", label: "Inquiry" },
  { value: "ESTIMATE_SENT", label: "Estimate" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "PAID", label: "Paid" },
  { value: "CLOSED", label: "Closed" },
];

interface ProjectStatusStepperProps {
  projectId: string;
  currentStatus: string;
}

export function ProjectStatusStepper({ projectId, currentStatus }: ProjectStatusStepperProps) {
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const currentIndex = STATUSES.findIndex((s) => s.value === status);

  async function doUpdate(value: string) {
    setUpdating(true);
    setConfirmTarget(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setStatus(value);
      toast.success("Project status updated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  function handleClick(value: string) {
    if (value === status || updating) return;
    const targetIndex = STATUSES.findIndex((s) => s.value === value);
    // Backward jump → ask for confirmation
    if (targetIndex < currentIndex) {
      setConfirmTarget(value);
    } else {
      doUpdate(value);
    }
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center w-full overflow-x-auto">
        {STATUSES.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.value} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => handleClick(step.value)}
                disabled={updating}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 w-full transition-colors",
                  "hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : isCurrent
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-400"
                  )}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <span
                  className={cn(
                    "text-xs text-center leading-tight",
                    isCurrent ? "font-semibold text-blue-600" : "text-gray-500"
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < STATUSES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    isCompleted ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Backward jump confirmation */}
      {confirmTarget && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-amber-800">
            Move status back to <strong>{STATUSES.find((s) => s.value === confirmTarget)?.label}</strong>?
          </span>
          <button
            onClick={() => doUpdate(confirmTarget)}
            className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmTarget(null)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

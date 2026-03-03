"use client";

import { useState } from "react";
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

  const currentIndex = STATUSES.findIndex((s) => s.value === status);

  async function handleClick(value: string) {
    if (value === status || updating) return;
    setUpdating(true);
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

  return (
    <div className="w-full">
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
    </div>
  );
}

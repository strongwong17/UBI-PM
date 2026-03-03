"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHASES = [
  { value: "RECRUITMENT", label: "Recruitment" },
  { value: "FIELDWORK", label: "Fieldwork" },
  { value: "ANALYSIS", label: "Analysis" },
  { value: "REPORTING", label: "Reporting" },
];

interface ExecutionPhaseSelectorProps {
  projectId: string;
  currentPhase: string | null;
  disabled?: boolean;
}

export function ExecutionPhaseSelector({
  projectId,
  currentPhase,
  disabled,
}: ExecutionPhaseSelectorProps) {
  const [phase, setPhase] = useState(currentPhase);
  const [updating, setUpdating] = useState(false);

  const currentIndex = PHASES.findIndex((p) => p.value === phase);

  async function handleClick(value: string) {
    if (value === phase || updating || disabled) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionPhase: value }),
      });
      if (!res.ok) throw new Error();
      setPhase(value);
      toast.success("Execution phase updated");
    } catch {
      toast.error("Failed to update phase");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-0 w-full">
      {PHASES.map((p, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={p.value} className="flex items-center flex-1">
            <button
              onClick={() => handleClick(p.value)}
              disabled={updating || disabled}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 w-full rounded transition-colors",
                "hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",
                isCurrent && "bg-purple-50"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  isCompleted
                    ? "bg-purple-500 border-purple-500 text-white"
                    : isCurrent
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-purple-700" : "text-gray-500"
                )}
              >
                {p.label}
              </span>
            </button>
            {index < PHASES.length - 1 && (
              <div
                className={cn("h-0.5 flex-shrink-0 w-4", isCompleted ? "bg-purple-400" : "bg-gray-200")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

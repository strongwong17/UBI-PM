"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectPickerDialog } from "./project-picker-dialog";

export function NewEstimateGate() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function handlePicked(projectId: string) {
    setOpen(false);
    router.replace(`/estimates/new?projectId=${projectId}`);
  }

  function handleCancel() {
    router.push("/estimates");
  }

  return (
    <div className="bg-card-rd rounded-[14px] p-10 text-center"
      style={{
        border: "1px dashed var(--color-hairline-strong)",
      }}
    >
      <p className="text-[13px] text-ink-500">
        Choose a project to start building this estimate.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
        style={{
          background: "var(--color-canvas-cool)",
          border: "1px solid var(--color-hairline-strong)",
        }}
      >
        Choose project
      </button>

      <ProjectPickerDialog
        open={open}
        onOpenChange={setOpen}
        onPicked={handlePicked}
        onCancel={handleCancel}
      />
    </div>
  );
}

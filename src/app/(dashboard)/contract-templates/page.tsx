"use client";

import { useContractStore } from "@/lib/contract-store";
import { CATEGORY_LABELS } from "@/lib/contract-types";
import { FileText, Plus, Pencil, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ContractTemplatesPage() {
  const templates = useContractStore((s) => s.templates);
  const deleteTemplate = useContractStore((s) => s.deleteTemplate);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
            Contract templates
          </h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">
            {"// "}{templates.length} {templates.length === 1 ? "template" : "templates"}
          </p>
        </div>
        <Link
          href="/contract-templates/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{
            background: "var(--color-accent-rd)",
            boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div
          className="bg-card-rd rounded-[14px] py-16 text-center"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <FileText className="mb-4 h-10 w-10 text-ink-300 mx-auto" />
          <h3 className="text-[15px] font-medium text-ink-900 mb-1">No templates yet</h3>
          <p className="text-[13px] text-ink-500 mb-5 max-w-sm mx-auto">
            Build a contract template once, then generate signed contracts in seconds.
          </p>
          <Link
            href="/contract-templates/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Create your first template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-card-rd rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-lg p-2"
                    style={{ background: "var(--color-canvas-cool)" }}
                  >
                    <FileText className="h-4 w-4 text-accent-rd" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-ink-900">{template.name}</h3>
                    <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                      {CATEGORY_LABELS[template.category]}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mb-4 line-clamp-2 text-[12px] text-ink-500">
                {template.description}
              </p>

              <div className="mb-4 font-mono text-[11px] text-ink-400 tracking-[0.02em]">
                {"// "}
                {template.placeholders.length} fields · updated{" "}
                {new Date(template.updatedAt).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/contracts/generate/${template.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                  style={{
                    background: "var(--color-accent-rd)",
                    boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
                  }}
                >
                  <Zap className="h-3 w-3" /> Generate
                </Link>
                <Link
                  href={`/contract-templates/${template.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                  style={{
                    background: "var(--color-canvas-cool)",
                    border: "1px solid var(--color-hairline-strong)",
                  }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
                {deleteConfirm === template.id ? (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => {
                        deleteTemplate(template.id);
                        setDeleteConfirm(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                      style={{ background: "var(--color-warn-fg)" }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
                      style={{
                        background: "var(--color-canvas-cool)",
                        border: "1px solid var(--color-hairline-strong)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(template.id)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-300 hover:text-warn-fg hover:bg-warn-bg"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

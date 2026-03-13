"use client";

import { useContractStore } from "@/lib/contract-store";
import { CATEGORY_LABELS } from "@/lib/contract-types";
import { FileText, Plus, Pencil, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function TemplatesPage() {
  const templates = useContractStore((s) => s.templates);
  const deleteTemplate = useContractStore((s) => s.deleteTemplate);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Templates
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your contract templates.
          </p>
        </div>
        <Link
          href="/contract-templates/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16 dark:border-zinc-700 dark:bg-zinc-950">
          <FileText className="mb-4 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No templates yet
          </p>
          <Link
            href="/contract-templates/new"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {template.name}
                    </h3>
                    <span className="text-xs text-zinc-400">
                      {CATEGORY_LABELS[template.category]}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mb-4 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                {template.description}
              </p>

              <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
                <span>{template.placeholders.length} fields</span>
                <span>&middot;</span>
                <span>
                  Updated{" "}
                  {new Date(template.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/contracts/generate/${template.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Zap className="h-3 w-3" />
                  Generate
                </Link>
                <Link
                  href={`/contract-templates/${template.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Link>
                {deleteConfirm === template.id ? (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => {
                        deleteTemplate(template.id);
                        setDeleteConfirm(null);
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(template.id)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

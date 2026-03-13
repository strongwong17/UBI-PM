"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractStore, extractPlaceholders } from "@/lib/contract-store";
import type { ContractTemplate as Template, Exhibit } from "@/lib/contract-types";
import { ArrowLeft, Save, Eye, EyeOff, Info } from "lucide-react";
import Link from "next/link";
import ExhibitEditor from "@/components/contracts/exhibit-editor";

export default function NewTemplatePage() {
  const router = useRouter();
  const addTemplate = useContractStore((s) => s.addTemplate);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Template["category"]>("service-agreement");
  const [content, setContent] = useState("");
  const [exhibits, setExhibits] = useState<Exhibit[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const detectedPlaceholders = extractPlaceholders(content, exhibits);

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;

    const id = addTemplate({
      name: name.trim(),
      description: description.trim(),
      category,
      content,
      exhibits,
      placeholders: detectedPlaceholders,
    });

    router.push(`/contract-templates/${id}`);
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/contract-templates"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Templates
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Create Template
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Template Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Service Agreement"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Template["category"])}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="service-agreement">Service Agreement</option>
                  <option value="sow">Statement of Work</option>
                  <option value="vendor">Vendor Contract</option>
                  <option value="nda">Non-Disclosure Agreement</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Template Content
                </label>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Editor
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </>
                  )}
                </button>
              </div>

              {showPreview ? (
                <div className="min-h-[400px] whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {content || (
                    <span className="text-zinc-400">Nothing to preview</span>
                  )}
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Enter your contract template here.\n\nUse {{placeholder_name}} for dynamic fields.\nExample: {{client_name}}, {{effective_date}}, {{total_amount}}`}
                  rows={20}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              )}
            </div>
          </div>

          {/* Exhibits Section */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <ExhibitEditor exhibits={exhibits} onChange={setExhibits} />
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/contract-templates"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !content.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save Template
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <Info className="h-4 w-4" />
              Placeholder Syntax
            </div>
            <p className="text-xs leading-relaxed text-blue-600 dark:text-blue-400">
              Use <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">{"{{field_name}}"}</code> to
              create dynamic fields. They will be auto-detected and turned into
              form inputs when generating a contract. Works in both the main
              content and exhibits.
            </p>
          </div>

          {detectedPlaceholders.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Detected Fields ({detectedPlaceholders.length})
              </h3>
              <div className="space-y-2">
                {detectedPlaceholders.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {p.label}
                    </span>
                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {p.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

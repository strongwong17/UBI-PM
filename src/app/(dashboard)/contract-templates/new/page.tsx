"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractStore, extractPlaceholders } from "@/lib/contract-store";
import type { ContractTemplate as Template, Exhibit } from "@/lib/contract-types";
import { ArrowLeft, Save, Eye, EyeOff, Info } from "lucide-react";
import Link from "next/link";
import ExhibitEditor from "@/components/contracts/exhibit-editor";

export default function NewContractTemplatePage() {
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
    <div className="space-y-6">
      <div>
        <Link
          href="/contract-templates"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
              New contract template
            </h1>
            <p className="text-[13px] text-ink-500 m-0 max-w-[520px]">
              Use{" "}
              <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-canvas-cool">
                {"{{field_name}}"}
              </code>{" "}
              for dynamic fields — they&apos;ll be auto-detected and turned into form inputs when
              generating a contract.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Template info */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// TEMPLATE INFO"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5 space-y-4"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                    {"// NAME *"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Service Agreement"
                    className="w-full px-3 py-2 rounded-md text-[13px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10"
                    style={{
                      background: "var(--color-card-rd)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                    {"// CATEGORY"}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Template["category"])}
                    className="w-full px-3 py-2 rounded-md text-[13px] text-ink-900 outline-none focus:ring-2 focus:ring-ink-900/10"
                    style={{
                      background: "var(--color-card-rd)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    <option value="service-agreement">Service Agreement</option>
                    <option value="sow">Statement of Work</option>
                    <option value="vendor">Vendor Contract</option>
                    <option value="nda">Non-Disclosure Agreement</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                  {"// DESCRIPTION"}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this template"
                  className="w-full px-3 py-2 rounded-md text-[13px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10"
                  style={{
                    background: "var(--color-card-rd)",
                    border: "1px solid var(--color-hairline)",
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                    {"// CONTENT"}
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-ink-500 hover:text-ink-900 hover:bg-[#FCFAF6]"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="h-3 w-3" /> Editor
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Preview
                      </>
                    )}
                  </button>
                </div>
                {showPreview ? (
                  <div
                    className="min-h-[400px] whitespace-pre-wrap rounded-md p-4 font-mono text-[12px] text-ink-700"
                    style={{
                      background: "#FAFAF6",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    {content || <span className="text-ink-300">Nothing to preview</span>}
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`Enter your contract template here.\n\nUse {{placeholder_name}} for dynamic fields.\nExample: {{client_name}}, {{effective_date}}, {{total_amount}}`}
                    rows={20}
                    className="w-full px-3 py-2 rounded-md font-mono text-[12px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10 resize-none"
                    style={{
                      background: "var(--color-card-rd)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Exhibits */}
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// EXHIBITS"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <ExhibitEditor exhibits={exhibits} onChange={setExhibits} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// PLACEHOLDER SYNTAX"}
            </p>
            <div
              className="rounded-[14px] p-4"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-ink-900">
                <Info className="h-3.5 w-3.5 text-accent-rd" />
                How placeholders work
              </div>
              <p className="text-[12px] leading-relaxed text-ink-700">
                Use{" "}
                <code className="font-mono text-[11px] rounded bg-card-rd px-1 py-0.5 border border-hairline">
                  {"{{field_name}}"}
                </code>{" "}
                in the body or exhibits — they&apos;ll be auto-detected and become form inputs when
                generating a contract.
              </p>
            </div>
          </div>

          {detectedPlaceholders.length > 0 && (
            <div>
              <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
                {"// DETECTED FIELDS"} · {detectedPlaceholders.length}
              </p>
              <div
                className="bg-card-rd rounded-[14px] p-4 space-y-2"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                {detectedPlaceholders.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between rounded-md px-3 py-2"
                    style={{ background: "#FAFAF6" }}
                  >
                    <span className="text-[12px] text-ink-700">{p.label}</span>
                    <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase rounded px-1.5 py-0.5 bg-canvas-cool text-ink-500">
                      {p.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action footer */}
      <div
        className="flex items-center justify-between p-4 rounded-[14px] mt-5 sticky"
        style={{
          background: "var(--color-card-rd)",
          border: "1px solid var(--color-hairline)",
          boxShadow:
            "0 6px 24px -6px rgba(15, 23, 41, 0.10), 0 2px 6px -2px rgba(15, 23, 41, 0.06)",
          bottom: 16,
          zIndex: 5,
        }}
      >
        <div className="text-[12px] text-ink-500">
          <strong className="text-ink-900 font-bold rd-tabular">
            {detectedPlaceholders.length}
          </strong>{" "}
          {detectedPlaceholders.length === 1 ? "field" : "fields"} ·{" "}
          <strong className="text-ink-900 font-bold rd-tabular">{exhibits.length}</strong>{" "}
          {exhibits.length === 1 ? "exhibit" : "exhibits"}
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href="/contract-templates"
            className="px-3 py-2 rounded-lg text-[13px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)]"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !content.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-accent-rd)",
              boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
            }}
          >
            <Save className="h-4 w-4" />
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

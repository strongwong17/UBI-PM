"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useContractStore, renderTemplate } from "@/lib/contract-store";
import { CATEGORY_LABELS, FIELD_PREFIXES, companyToFields } from "@/lib/contract-types";
import { useClients } from "@/lib/use-clients";
import { exportToDocx } from "@/lib/export-docx";
import { openStyledPrintWindow } from "@/lib/export-pdf";
import {
  ArrowLeft,
  FileText,
  Eye,
  Download,
  Save,
  ChevronRight,
  FileDown,
} from "lucide-react";
import Link from "next/link";
import ContactPicker from "@/components/contracts/contact-picker";
import { logClientActivity } from "@/lib/log-client-activity";

type Step = "fill" | "preview";

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const getTemplate = useContractStore((s) => s.getTemplate);
  const addContract = useContractStore((s) => s.addContract);
  const { companies, businessProfile } = useClients();

  const template = getTemplate(params.id as string);
  const [step, setStep] = useState<Step>("fill");
  const [contractName, setContractName] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [providerPrefilled, setProviderPrefilled] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (providerPrefilled || !template || !businessProfile) return;
    const providerPrefixes = FIELD_PREFIXES.filter(
      (fp) => fp.prefix === "provider_" || fp.prefix === "company_",
    );
    const placeholderKeys = new Set(template.placeholders.map((p) => p.key));
    const hasProviderFields = providerPrefixes.some((fp) =>
      template.placeholders.some((p) => p.key.startsWith(fp.prefix)),
    );
    if (hasProviderFields) {
      const autoFields: Record<string, string> = {};
      for (const fp of providerPrefixes) {
        const fields = companyToFields(fp.prefix, businessProfile);
        for (const [key, value] of Object.entries(fields)) {
          if (placeholderKeys.has(key) && value) {
            autoFields[key] = value;
          }
        }
      }
      if (Object.keys(autoFields).length > 0) {
        setFormData((prev) => ({ ...autoFields, ...prev }));
      }
    }
    setProviderPrefilled(true);
  }, [template, businessProfile, providerPrefilled]);

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="text-center">
          <p className="text-[13px] text-ink-500">Template not found</p>
          <Link
            href="/contract-templates"
            className="mt-2 inline-block text-[13px] text-accent-rd hover:underline"
          >
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  const exhibits = template.exhibits || [];

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const renderedContent = renderTemplate(template.content, formData, exhibits);

  const allRequiredFilled = template.placeholders
    .filter((p) => p.required)
    .every((p) => formData[p.key]?.trim());

  const handleSave = (status: "draft" | "final") => {
    const name = contractName.trim() || `${template.name} - ${new Date().toLocaleDateString()}`;
    const id = addContract({
      templateId: template.id,
      templateName: template.name,
      name,
      data: formData,
      content: renderedContent,
      status,
    });
    logClientActivity({
      action: "GENERATE",
      entityType: "CONTRACT",
      entityId: id,
      entityLabel: name,
      description: `Generated contract "${name}" from template "${template.name}" as ${status}`,
    });
    router.push(`/contracts/${id}`);
  };

  const handlePrint = () => {
    openStyledPrintWindow(renderedContent, contractName || template.name);
  };

  const handleExportWord = async () => {
    const mainContent = renderTemplate(template.content, formData);
    const renderedExhibitContents = exhibits.map((e) => renderTemplate(e.content, formData));
    await exportToDocx(
      mainContent,
      contractName || template.name,
      exhibits,
      renderedExhibitContents,
    );
  };

  const inputClass =
    "w-full px-3 py-2 rounded-md text-[13px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10";
  const inputStyle: React.CSSProperties = {
    background: "var(--color-card-rd)",
    border: "1px solid var(--color-hairline)",
  };
  const secondaryBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd";
  const secondaryStyle: React.CSSProperties = {
    background: "var(--color-canvas-cool)",
    border: "1px solid var(--color-hairline-strong)",
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
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg p-2"
              style={{ background: "var(--color-canvas-cool)" }}
            >
              <FileText className="h-4 w-4 text-accent-rd" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
                Generate · {template.name}
              </h1>
              <p className="font-mono text-[11px] text-ink-500 tracking-[0.04em]">
                {CATEGORY_LABELS[template.category]}
                {exhibits.length > 0 &&
                  ` · ${exhibits.length} ${exhibits.length === 1 ? "exhibit" : "exhibits"}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep("fill")}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={
            step === "fill"
              ? { background: "var(--color-ink-900)", color: "white" }
              : {
                  background: "var(--color-canvas-cool)",
                  color: "var(--color-ink-500)",
                  border: "1px solid var(--color-hairline-strong)",
                }
          }
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{
              background:
                step === "fill" ? "rgba(255,255,255,0.2)" : "var(--color-card-rd)",
            }}
          >
            1
          </span>
          Fill details
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
        <button
          onClick={() => setStep("preview")}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={
            step === "preview"
              ? { background: "var(--color-ink-900)", color: "white" }
              : {
                  background: "var(--color-canvas-cool)",
                  color: "var(--color-ink-500)",
                  border: "1px solid var(--color-hairline-strong)",
                }
          }
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{
              background:
                step === "preview" ? "rgba(255,255,255,0.2)" : "var(--color-card-rd)",
            }}
          >
            2
          </span>
          Preview & save
        </button>
      </div>

      {step === "fill" ? (
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// CONTRACT NAME"}
            </p>
            <div
              className="bg-card-rd rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder={`${template.name} - ${new Date().toLocaleDateString()}`}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div
              className="flex items-start justify-between gap-3 pb-3 mb-3"
              style={{ borderBottom: "1px solid var(--color-hairline)" }}
            >
              <div>
                <h2 className="text-[20px] font-bold tracking-[-0.02em] m-0 text-ink-900">
                  Contract details
                </h2>
                <p className="text-[12px] text-ink-500 m-0">
                  {template.placeholders.length} fields
                </p>
              </div>
              <ContactPicker
                placeholders={template.placeholders}
                formData={formData}
                onApply={(fields) => setFormData((prev) => ({ ...prev, ...fields }))}
                companies={companies}
              />
            </div>
            <div
              className="bg-card-rd rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {template.placeholders.map((placeholder) => (
                  <div
                    key={placeholder.key}
                    className={
                      placeholder.type === "textarea" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"
                    }
                  >
                    <label className="block font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-500">
                      {"// "}
                      {placeholder.label.toUpperCase()}
                      {placeholder.required && " *"}
                    </label>
                    {placeholder.type === "textarea" ? (
                      <textarea
                        value={formData[placeholder.key] || ""}
                        onChange={(e) => updateField(placeholder.key, e.target.value)}
                        rows={3}
                        placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                        className={`${inputClass} resize-none`}
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        type={placeholder.type === "number" ? "text" : placeholder.type}
                        value={formData[placeholder.key] || ""}
                        onChange={(e) => updateField(placeholder.key, e.target.value)}
                        placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                        className={inputClass}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep("preview")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em]"
              style={{
                background: "var(--color-accent-rd)",
                boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
              }}
            >
              <Eye className="h-4 w-4" /> Preview contract
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
              {"// CONTRACT PREVIEW"}
            </p>
            <div
              ref={previewRef}
              className="bg-card-rd rounded-[14px] p-8"
              style={{
                border: "1px solid var(--color-hairline)",
                boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
              }}
            >
              <div className="mx-auto max-w-2xl">
                <pre className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-ink-900">
                  {renderedContent}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => setStep("fill")}
              className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to edit
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleExportWord} className={secondaryBtn} style={secondaryStyle}>
                <FileDown className="h-3.5 w-3.5" /> Export Word
              </button>
              <button onClick={handlePrint} className={secondaryBtn} style={secondaryStyle}>
                <Download className="h-3.5 w-3.5" /> Print / PDF
              </button>
              <button
                onClick={() => handleSave("draft")}
                className={secondaryBtn}
                style={secondaryStyle}
              >
                <Save className="h-3.5 w-3.5" /> Save as draft
              </button>
              <button
                onClick={() => handleSave("final")}
                disabled={!allRequiredFilled}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white tracking-[-0.005em] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--color-accent-rd)",
                  boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
                }}
              >
                <Save className="h-4 w-4" /> Save as final
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

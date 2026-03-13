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

  // Auto-fill business profile (UBInsights) as default provider on first load
  useEffect(() => {
    if (providerPrefilled || !template || !businessProfile) return;

    const providerPrefixes = FIELD_PREFIXES.filter(
      (fp) =>
        fp.prefix === "provider_" || fp.prefix === "company_"
    );

    const placeholderKeys = new Set(template.placeholders.map((p) => p.key));
    const hasProviderFields = providerPrefixes.some((fp) =>
      template.placeholders.some((p) => p.key.startsWith(fp.prefix))
    );

    if (hasProviderFields) {
      let autoFields: Record<string, string> = {};

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
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500">Template not found</p>
          <Link href="/contract-templates" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
            Back to Templates
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
    const renderedExhibitContents = exhibits.map((e) =>
      renderTemplate(e.content, formData)
    );
    await exportToDocx(
      mainContent,
      contractName || template.name,
      exhibits,
      renderedExhibitContents
    );
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
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Generate: {template.name}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABELS[template.category]}
              {exhibits.length > 0 && ` · ${exhibits.length} exhibit(s)`}
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setStep("fill")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            step === "fill"
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
            1
          </span>
          Fill Details
        </button>
        <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
        <button
          onClick={() => setStep("preview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            step === "preview"
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
            2
          </span>
          Preview & Save
        </button>
      </div>

      {step === "fill" ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Contract Name
              </label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder={`${template.name} - ${new Date().toLocaleDateString()}`}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Contract Details
              </h2>
              <ContactPicker
                placeholders={template.placeholders}
                formData={formData}
                onApply={(fields) =>
                  setFormData((prev) => ({ ...prev, ...fields }))
                }
                companies={companies}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {template.placeholders.map((placeholder) => (
                <div
                  key={placeholder.key}
                  className={
                    placeholder.type === "textarea" ? "sm:col-span-2" : ""
                  }
                >
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {placeholder.label}
                    {placeholder.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>
                  {placeholder.type === "textarea" ? (
                    <textarea
                      value={formData[placeholder.key] || ""}
                      onChange={(e) =>
                        updateField(placeholder.key, e.target.value)
                      }
                      rows={3}
                      placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  ) : (
                    <input
                      type={placeholder.type === "number" ? "text" : placeholder.type}
                      value={formData[placeholder.key] || ""}
                      onChange={(e) =>
                        updateField(placeholder.key, e.target.value)
                      }
                      placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep("preview")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Eye className="h-4 w-4" />
              Preview Contract
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            ref={previewRef}
            className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mx-auto max-w-2xl">
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                {renderedContent}
              </pre>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep("fill")}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Edit
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportWord}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <FileDown className="h-4 w-4" />
                Export Word
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                Print / PDF
              </button>
              <button
                onClick={() => handleSave("draft")}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </button>
              <button
                onClick={() => handleSave("final")}
                disabled={!allRequiredFilled}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Save as Final
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

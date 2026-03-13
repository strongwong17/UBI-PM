"use client";

import { useParams, useRouter } from "next/navigation";
import { useContractStore } from "@/lib/contract-store";
import { exportToDocx } from "@/lib/export-docx";
import { openStyledPrintWindow } from "@/lib/export-pdf";
import {
  ArrowLeft,
  Download,
  Pencil,
  Copy,
  Check,
  FileText,
  FileDown,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { logClientActivity } from "@/lib/log-client-activity";

export default function ContractViewPage() {
  const params = useParams();
  const router = useRouter();
  const getContract = useContractStore((s) => s.getContract);
  const getTemplate = useContractStore((s) => s.getTemplate);
  const updateContract = useContractStore((s) => s.updateContract);

  const contract = getContract(params.id as string);
  const template = contract ? getTemplate(contract.templateId) : undefined;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");

  if (!contract) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500">Contract not found</p>
          <Link href="/contracts" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
            Back to Contracts
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = contract.status === "draft";

  const handlePrint = () => {
    openStyledPrintWindow(editing ? editContent : contract.content, contract.name);
  };

  const handleExportWord = async () => {
    await exportToDocx(editing ? editContent : contract.content, contract.name);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editing ? editContent : contract.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleStatus = () => {
    const newStatus = contract.status === "draft" ? "final" : "draft";
    updateContract(contract.id, { status: newStatus });
    logClientActivity({
      action: "STATUS_CHANGE",
      entityType: "CONTRACT",
      entityId: contract.id,
      entityLabel: contract.name,
      description: `Changed contract "${contract.name}" status from ${contract.status} to ${newStatus}`,
      metadata: { from: contract.status, to: newStatus },
    });
  };

  const startEditing = () => {
    setEditContent(contract.content);
    setEditName(contract.name);
    setEditing(true);
  };

  const saveEdits = () => {
    updateContract(contract.id, {
      content: editContent,
      name: editName,
    });
    logClientActivity({
      action: "UPDATE",
      entityType: "CONTRACT",
      entityId: contract.id,
      entityLabel: editName,
      description: `Updated contract "${editName}"`,
    });
    setEditing(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditContent("");
    setEditName("");
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/contracts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Contracts
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              {editing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1 text-2xl font-bold text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              ) : (
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {contract.name}
                </h1>
              )}
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{contract.templateName}</span>
                <span>&middot;</span>
                <span>
                  Created {new Date(contract.createdAt).toLocaleDateString()}
                </span>
                <span>&middot;</span>
                <button
                  onClick={toggleStatus}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    contract.status === "final"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {contract.status === "final" ? "Final" : "Draft"} (click to toggle)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={saveEdits}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <div className="mx-2 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          </>
        ) : (
          isDraft && (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Draft
            </button>
          )
        )}
        <button
          onClick={handleExportWord}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export Word
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Download className="h-3.5 w-3.5" />
          Print / PDF
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy Text
            </>
          )}
        </button>
        {!editing && (
          <Link
            href={`/contracts/generate/${contract.templateId}`}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Generate New
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl">
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[600px] rounded-lg border border-zinc-200 bg-white px-4 py-3 font-serif text-sm leading-relaxed text-zinc-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              style={{ resize: "vertical" }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {contract.content}
            </pre>
          )}
        </div>
      </div>

      {!editing && Object.keys(contract.data).length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Field Values Used
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(contract.data).map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900"
              >
                <p className="text-xs font-medium text-zinc-400">
                  {key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {value || "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

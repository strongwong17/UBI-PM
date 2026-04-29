"use client";

import { useParams } from "next/navigation";
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
  const getContract = useContractStore((s) => s.getContract);
  const updateContract = useContractStore((s) => s.updateContract);

  const contract = getContract(params.id as string);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");

  if (!contract) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="text-center">
          <p className="text-[13px] text-ink-500">Contract not found</p>
          <Link
            href="/contracts"
            className="mt-2 inline-block text-[13px] text-accent-rd hover:underline"
          >
            Back to contracts
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

  const secondaryBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd";
  const secondaryStyle: React.CSSProperties = {
    background: "var(--color-canvas-cool)",
    border: "1px solid var(--color-hairline-strong)",
  };
  const primaryBtn =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white";
  const primaryStyle: React.CSSProperties = {
    background: "var(--color-accent-rd)",
    boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to contracts
        </Link>

        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="rounded-lg p-2"
              style={{ background: "var(--color-canvas-cool)" }}
            >
              <FileText className="h-4 w-4 text-accent-rd" />
            </div>
            <div>
              {editing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-md px-3 py-1 text-[24px] font-bold text-ink-900 outline-none focus:ring-2 focus:ring-accent-rd/40"
                  style={{
                    background: "var(--color-card-rd)",
                    border: "1px solid var(--color-accent-rd)",
                  }}
                />
              ) : (
                <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900 m-0">
                  {contract.name}
                </h1>
              )}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap font-mono text-[11px] text-ink-500 tracking-[0.04em]">
                <span>{contract.templateName}</span>
                <span>·</span>
                <span>Created {new Date(contract.createdAt).toLocaleDateString()}</span>
                <span>·</span>
                <button
                  onClick={toggleStatus}
                  title="Click to toggle"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold tracking-[0.06em] uppercase transition-colors"
                  style={{
                    background:
                      contract.status === "final"
                        ? "var(--color-s-approved-bg)"
                        : "var(--color-canvas-cool)",
                    color:
                      contract.status === "final"
                        ? "var(--color-s-approved-fg)"
                        : "var(--color-ink-700)",
                    border:
                      contract.status === "final"
                        ? "none"
                        : "1px solid var(--color-hairline-strong)",
                  }}
                >
                  {contract.status === "final" ? "Final" : "Draft"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {editing ? (
          <>
            <button onClick={saveEdits} className={primaryBtn} style={primaryStyle}>
              <Save className="h-3.5 w-3.5" /> Save changes
            </button>
            <button onClick={cancelEditing} className={secondaryBtn} style={secondaryStyle}>
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <div className="mx-1 h-4 w-px bg-hairline" />
          </>
        ) : (
          isDraft && (
            <button onClick={startEditing} className={primaryBtn} style={primaryStyle}>
              <Pencil className="h-3.5 w-3.5" /> Edit draft
            </button>
          )
        )}
        <button onClick={handleExportWord} className={secondaryBtn} style={secondaryStyle}>
          <FileDown className="h-3.5 w-3.5" /> Export Word
        </button>
        <button onClick={handlePrint} className={secondaryBtn} style={secondaryStyle}>
          <Download className="h-3.5 w-3.5" /> Print / PDF
        </button>
        <button onClick={handleCopy} className={secondaryBtn} style={secondaryStyle}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-s-approved-fg" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy text
            </>
          )}
        </button>
        {!editing && (
          <Link
            href={`/contracts/generate/${contract.templateId}`}
            className={secondaryBtn}
            style={secondaryStyle}
          >
            <Pencil className="h-3.5 w-3.5" /> Generate new
          </Link>
        )}
      </div>

      {/* Document */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// CONTRACT BODY"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-8"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="mx-auto max-w-2xl">
            {editing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[600px] rounded-md px-4 py-3 font-serif text-[14px] leading-relaxed text-ink-900 outline-none focus:ring-2 focus:ring-ink-900/10"
                style={{
                  background: "var(--color-card-rd)",
                  border: "1px solid var(--color-hairline)",
                  resize: "vertical",
                }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-ink-900">
                {contract.content}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Field values */}
      {!editing && Object.keys(contract.data).length > 0 && (
        <div>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
            {"// FIELD VALUES USED"}
          </p>
          <div
            className="bg-card-rd rounded-[14px] p-5"
            style={{
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(contract.data).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-md px-3 py-2"
                  style={{ background: "#FAFAF6" }}
                >
                  <div className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-0.5">
                    {"// "}
                    {key.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div className="text-[13px] text-ink-900">{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

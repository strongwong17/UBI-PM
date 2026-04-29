"use client";

import { useContractStore } from "@/lib/contract-store";
import { ScrollText, Trash2, Eye, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { logClientActivity } from "@/lib/log-client-activity";
import { cn } from "@/lib/utils";

export default function ContractsPage() {
  const contracts = useContractStore((s) => s.contracts);
  const deleteContract = useContractStore((s) => s.deleteContract);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "final">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = contracts
    .filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (
        search &&
        !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.templateName.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-5">
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
            Contracts
          </h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">
            {"// "}{contracts.length} {contracts.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-300 outline-none focus:ring-2 focus:ring-ink-900/10"
            style={{
              background: "var(--color-card-rd)",
              border: "1px solid var(--color-hairline)",
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "draft", "final"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                filter === f
                  ? "bg-ink-900 text-white"
                  : "bg-card-rd text-ink-700 border border-hairline hover:border-hairline-strong",
              )}
            >
              {f === "all" ? "All" : f === "draft" ? "Drafts" : "Final"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="bg-card-rd rounded-[14px] py-16 text-center"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <ScrollText className="mb-3 h-10 w-10 text-ink-300 mx-auto" />
          <p className="text-[13px] font-medium text-ink-500">
            {contracts.length === 0
              ? "No contracts generated yet"
              : "No contracts match your search"}
          </p>
          {contracts.length === 0 && (
            <Link
              href="/contract-templates"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent-rd hover:underline"
            >
              Generate from a template
            </Link>
          )}
        </div>
      ) : (
        <div
          className="bg-card-rd rounded-[14px] overflow-hidden"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          {filtered.map((contract, i) => (
            <div
              key={contract.id}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
              style={{
                borderBottom:
                  i < filtered.length - 1 ? "1px solid var(--color-hairline)" : "none",
              }}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-[13px] font-medium text-ink-900 hover:text-accent-rd"
                >
                  {contract.name}
                </Link>
                <p className="text-[12px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">
                  {"// "}
                  {contract.templateName} ·{" "}
                  {new Date(contract.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
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
                </span>

                <Link
                  href={`/contracts/${contract.id}`}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-[#FCFAF6]"
                  aria-label="View"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>

                {deleteConfirm === contract.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        logClientActivity({
                          action: "DELETE",
                          entityType: "CONTRACT",
                          entityId: contract.id,
                          entityLabel: contract.name,
                          description: `Deleted contract "${contract.name}"`,
                        });
                        deleteContract(contract.id);
                        setDeleteConfirm(null);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white"
                      style={{ background: "var(--color-warn-fg)" }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-ink-500 hover:bg-[#FCFAF6]"
                      style={{
                        border: "1px solid var(--color-hairline)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(contract.id)}
                    className="rounded-lg p-1.5 text-ink-300 hover:text-warn-fg hover:bg-warn-bg"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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

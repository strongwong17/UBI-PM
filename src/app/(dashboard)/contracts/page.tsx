"use client";

import { useContractStore } from "@/lib/contract-store";
import { ScrollText, Trash2, Eye, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { logClientActivity } from "@/lib/log-client-activity";

export default function ContractsPage() {
  const contracts = useContractStore((s) => s.contracts);
  const deleteContract = useContractStore((s) => s.deleteContract);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "final">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = contracts
    .filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.templateName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Contracts
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          View and manage generated contracts.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          {(["all", "draft", "final"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {f === "all" ? "All" : f === "draft" ? "Drafts" : "Final"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16 dark:border-zinc-700 dark:bg-zinc-950">
          <ScrollText className="mb-4 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {contracts.length === 0
              ? "No contracts generated yet"
              : "No contracts match your search"}
          </p>
          {contracts.length === 0 && (
            <Link
              href="/contract-templates"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Generate from a template
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {filtered.map((contract, i) => (
            <div
              key={contract.id}
              className={`flex items-center justify-between p-4 ${
                i !== filtered.length - 1
                  ? "border-b border-zinc-100 dark:border-zinc-800"
                  : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                >
                  {contract.name}
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {contract.templateName} &middot;{" "}
                  {new Date(contract.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    contract.status === "final"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {contract.status === "final" ? "Final" : "Draft"}
                </span>

                <Link
                  href={`/contracts/${contract.id}`}
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
                      className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(contract.id)}
                    className="rounded-lg border border-zinc-200 p-1.5 text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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

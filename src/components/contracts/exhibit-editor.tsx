"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Exhibit } from "@/lib/contract-types";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  FileText,
} from "lucide-react";

const EXHIBIT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface ExhibitEditorProps {
  exhibits: Exhibit[];
  onChange: (exhibits: Exhibit[]) => void;
}

export default function ExhibitEditor({
  exhibits,
  onChange,
}: ExhibitEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addExhibit = () => {
    const nextLetter = EXHIBIT_LETTERS[exhibits.length] || `${exhibits.length + 1}`;
    const newExhibit: Exhibit = {
      id: uuidv4(),
      label: `Exhibit ${nextLetter}`,
      title: "",
      content: "",
    };
    onChange([...exhibits, newExhibit]);
    setExpandedId(newExhibit.id);
  };

  const updateExhibit = (id: string, updates: Partial<Exhibit>) => {
    onChange(
      exhibits.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const removeExhibit = (id: string) => {
    onChange(exhibits.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const moveExhibit = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= exhibits.length) return;
    const updated = [...exhibits];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    // Re-label based on position
    const relabeled = updated.map((e, i) => ({
      ...e,
      label: `Exhibit ${EXHIBIT_LETTERS[i] || i + 1}`,
    }));
    onChange(relabeled);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Exhibits ({exhibits.length})
        </h3>
        <button
          onClick={addExhibit}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-3 w-3" />
          Add Exhibit
        </button>
      </div>

      {exhibits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8 dark:border-zinc-700">
          <FileText className="mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            No exhibits yet. Click &quot;Add Exhibit&quot; to attach one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {exhibits.map((exhibit, index) => (
            <div
              key={exhibit.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              {/* Header */}
              <div
                className="flex cursor-pointer items-center gap-2 px-3 py-2.5"
                onClick={() =>
                  setExpandedId(expandedId === exhibit.id ? null : exhibit.id)
                }
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {exhibit.label}
                </span>
                <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {exhibit.title || (
                    <span className="italic text-zinc-400">Untitled</span>
                  )}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveExhibit(index, "up");
                    }}
                    disabled={index === 0}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveExhibit(index, "down");
                    }}
                    disabled={index === exhibits.length - 1}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExhibit(exhibit.id);
                    }}
                    className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expandedId === exhibit.id ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === exhibit.id && (
                <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Title
                    </label>
                    <input
                      type="text"
                      value={exhibit.title}
                      onChange={(e) =>
                        updateExhibit(exhibit.id, { title: e.target.value })
                      }
                      placeholder="e.g. Detailed Scope of Services"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Content (supports {"{{placeholder}}"} syntax)
                    </label>
                    <textarea
                      value={exhibit.content}
                      onChange={(e) =>
                        updateExhibit(exhibit.id, { content: e.target.value })
                      }
                      rows={8}
                      placeholder="Enter exhibit content..."
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface FeedbackSnapshot {
  internalContent: string | null;
  internalSubmittedAt: string | null;
  internalSubmittedBy: { name: string } | null;
  clientContent: string | null;
  clientSubmittedAt: string | null;
  clientSubmittedByName: string | null;
}

interface Props {
  projectId: string;
  projectStatus: string;
  initialFeedback: FeedbackSnapshot | null;
}

function fmtDateMono(iso: string): string {
  const d = new Date(iso);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function ProjectFeedbackSection({ projectId, projectStatus, initialFeedback }: Props) {
  const router = useRouter();
  const readOnly = projectStatus === "CLOSED";

  const [internalContent, setInternalContent] = useState(initialFeedback?.internalContent ?? "");
  const [clientContent, setClientContent] = useState(initialFeedback?.clientContent ?? "");
  const [clientName, setClientName] = useState(initialFeedback?.clientSubmittedByName ?? "");

  const internalSubmittedAt = initialFeedback?.internalSubmittedAt ?? null;
  const clientSubmittedAt = initialFeedback?.clientSubmittedAt ?? null;

  const [busy, setBusy] = useState<null | "internal-save" | "internal-submit" | "client-save" | "client-submit">(null);

  async function call(body: Record<string, unknown>, working: typeof busy): Promise<void> {
    setBusy(working);
    try {
      const r = await fetch(`/api/projects/${projectId}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Request failed");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-[14px] p-5 mb-5"
      style={{
        background: "var(--color-card-rd)",
        border: "1px solid var(--color-hairline)",
        boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
      }}
    >
      <div className="flex items-baseline justify-between mb-3.5">
        <p className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 text-ink-500">
          {"// FEEDBACK & RETROSPECTIVE"}
        </p>
        <p className="font-mono text-[10px] tracking-[0.02em] text-ink-400 m-0">
          Both required for auto-archive
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Internal feedback */}
        <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--color-hairline)" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-semibold text-ink-900 m-0">Internal feedback</h4>
            {internalSubmittedAt ? (
              <span
                className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--color-s-delivered-bg)",
                  color: "var(--color-s-delivered-fg)",
                }}
              >
                Submitted {fmtDateMono(internalSubmittedAt)}
                {initialFeedback?.internalSubmittedBy?.name
                  ? ` · ${initialFeedback.internalSubmittedBy.name}`
                  : ""}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-ink-400">Draft</span>
            )}
          </div>
          <textarea
            value={internalContent}
            disabled={readOnly || !!internalSubmittedAt}
            onChange={(e) => setInternalContent(e.target.value)}
            placeholder="What went well, what to improve, lessons for next project…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg text-[13px] text-ink-900 resize-y mb-3"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline)",
              minHeight: 90,
            }}
          />
          <div className="flex items-center gap-2 justify-end">
            {internalSubmittedAt ? (
              <button
                type="button"
                disabled={readOnly || busy !== null}
                onClick={() => call({ internalSubmit: false }, "internal-submit")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
              >
                Re-open
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={readOnly || busy !== null}
                  onClick={() => call({ internalContent }, "internal-save")}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
                >
                  {busy === "internal-save" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save draft"
                  )}
                </button>
                <button
                  type="button"
                  disabled={readOnly || busy !== null || internalContent.trim() === ""}
                  onClick={() => call({ internalContent, internalSubmit: true }, "internal-submit")}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--color-ink-900)" }}
                >
                  {busy === "internal-submit" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit"
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Client feedback */}
        <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--color-hairline)" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-semibold text-ink-900 m-0">Client feedback</h4>
            {clientSubmittedAt ? (
              <span
                className="font-mono text-[10px] font-bold tracking-[0.04em] uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--color-s-delivered-bg)",
                  color: "var(--color-s-delivered-fg)",
                }}
              >
                Submitted {fmtDateMono(clientSubmittedAt)}
                {initialFeedback?.clientSubmittedByName
                  ? ` · ${initialFeedback.clientSubmittedByName}`
                  : ""}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-ink-400">Draft</span>
            )}
          </div>
          <textarea
            value={clientContent}
            disabled={readOnly || !!clientSubmittedAt}
            onChange={(e) => setClientContent(e.target.value)}
            placeholder="Client's overall reaction, what they liked, anything they raised…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg text-[13px] text-ink-900 resize-y mb-3"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline)",
              minHeight: 90,
            }}
          />
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={clientName}
              disabled={readOnly || !!clientSubmittedAt}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client contact name (optional)"
              className="flex-1 px-2.5 py-1.5 rounded-md text-[12px] text-ink-900"
              style={{
                background: "var(--color-card-rd)",
                border: "1px solid var(--color-hairline)",
              }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            {clientSubmittedAt ? (
              <button
                type="button"
                disabled={readOnly || busy !== null}
                onClick={() => call({ clientSubmit: false }, "client-submit")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
              >
                Re-open
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={readOnly || busy !== null}
                  onClick={() =>
                    call(
                      { clientContent, clientSubmittedByName: clientName },
                      "client-save"
                    )
                  }
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-[rgba(15,23,41,0.04)] disabled:opacity-50"
                >
                  {busy === "client-save" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    "Save draft"
                  )}
                </button>
                <button
                  type="button"
                  disabled={readOnly || busy !== null || clientContent.trim() === ""}
                  onClick={() =>
                    call(
                      { clientContent, clientSubmittedByName: clientName, clientSubmit: true },
                      "client-submit"
                    )
                  }
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--color-ink-900)" }}
                >
                  {busy === "client-submit" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

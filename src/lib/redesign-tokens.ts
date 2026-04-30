// src/lib/redesign-tokens.ts
// Helpers for mapping a project / invoice / phase status to its color tokens.

export type ProjectStatus =
  | "ESTIMATING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CLOSED";

const STATUS_TOKENS: Record<string, { bg: string; fg: string; dot: string }> = {
  ESTIMATING:  { bg: "var(--color-s-estimating-bg)",  fg: "var(--color-s-estimating-fg)",  dot: "var(--color-s-estimating)" },
  APPROVED:    { bg: "var(--color-s-approved-bg)",    fg: "var(--color-s-approved-fg)",    dot: "var(--color-s-approved)" },
  IN_PROGRESS: { bg: "var(--color-s-in-progress-bg)", fg: "var(--color-s-in-progress-fg)", dot: "var(--color-s-in-progress)" },
  DELIVERED:   { bg: "var(--color-s-delivered-bg)",   fg: "var(--color-s-delivered-fg)",   dot: "var(--color-s-delivered)" },
  CLOSED:      { bg: "var(--color-s-closed-bg)",      fg: "var(--color-s-closed-fg)",      dot: "var(--color-s-closed)" },
};

export function statusTokens(status: string): { bg: string; fg: string; dot: string } {
  return (
    STATUS_TOKENS[status] ?? {
      bg: "var(--color-canvas-cool)",
      fg: "var(--color-ink-500)",
      dot: "var(--color-ink-300)",
    }
  );
}

const PHASE_TOKENS: Record<string, { bg: string; fg: string; dot: string }> = {
  RECRUITMENT: { bg: "var(--color-p-recruit-bg)", fg: "var(--color-p-recruit-fg)", dot: "var(--color-p-recruit)" },
  FIELDWORK:   { bg: "var(--color-p-field-bg)",   fg: "var(--color-p-field-fg)",   dot: "var(--color-p-field)" },
  ANALYSIS:    { bg: "var(--color-p-analyze-bg)", fg: "var(--color-p-analyze-fg)", dot: "var(--color-p-analyze)" },
  REPORTING:   { bg: "var(--color-p-report-bg)",  fg: "var(--color-p-report-fg)",  dot: "var(--color-p-report)" },
};

export function phaseTokens(phase: string): { bg: string; fg: string; dot: string } {
  return (
    PHASE_TOKENS[phase] ?? {
      bg: "var(--color-canvas-cool)",
      fg: "var(--color-ink-500)",
      dot: "var(--color-ink-300)",
    }
  );
}

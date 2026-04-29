import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Edit } from "lucide-react";
import { TemplateDeleteButton } from "@/components/templates/template-delete-button";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const template = await prisma.estimateTemplate.findUnique({
    where: { id },
    include: {
      phases: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template) notFound();

  const estimatedTotal = template.phases.reduce(
    (sum, phase) =>
      sum + phase.lineItems.reduce((s, li) => s + li.defaultQuantity * li.defaultPrice, 0),
    0,
  );

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/templates"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
        </Link>
        <div
          className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
          style={{ borderBottom: "1px solid var(--color-hairline)" }}
        >
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-900 m-0 mb-2">
              {template.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-[0.06em] uppercase"
                style={{
                  background: "var(--color-canvas-cool)",
                  color: "var(--color-ink-700)",
                  border: "1px solid var(--color-hairline-strong)",
                }}
              >
                {template.pricingModel}
              </span>
              {!template.isActive && (
                <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                  Inactive
                </span>
              )}
              {template.description && (
                <span className="text-[12px] text-ink-500 italic">— {template.description}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href={`/templates/${template.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
              style={{
                background: "var(--color-canvas-cool)",
                border: "1px solid var(--color-hairline-strong)",
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </Link>
            <TemplateDeleteButton templateId={template.id} templateName={template.name} />
          </div>
        </div>
      </div>

      {/* Phases */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// PHASES & DEFAULT ITEMS"}
        </p>
        <div className="space-y-4">
          {template.phases.map((phase, idx) => {
            const phaseTotal = phase.lineItems.reduce(
              (sum, li) => sum + li.defaultQuantity * li.defaultPrice,
              0,
            );
            return (
              <div
                key={phase.id}
                className="bg-card-rd rounded-[14px] overflow-hidden"
                style={{
                  border: "1px solid var(--color-hairline)",
                  boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
                }}
              >
                <div
                  className="px-5 py-3.5 flex items-center gap-3"
                  style={{
                    borderBottom: "1px solid var(--color-hairline)",
                    background: "linear-gradient(180deg, #FCFAF6 0%, #FFFFFF 100%)",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--color-ink-300)" }}
                  />
                  <h3 className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase m-0 text-ink-900">
                    Phase {idx + 1} · {phase.name}
                  </h3>
                  {phase.description && (
                    <span className="text-[12px] text-ink-500 italic">— {phase.description}</span>
                  )}
                  <span className="ml-auto font-mono text-[11px] tracking-[0.02em] text-ink-500">
                    {phase.lineItems.length}{" "}
                    {phase.lineItems.length === 1 ? "line" : "lines"} ·{" "}
                    <strong className="text-ink-900 font-bold rd-tabular">${fmt(phaseTotal)}</strong>
                  </span>
                </div>
                <div
                  className="grid gap-3 px-5 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    gridTemplateColumns: "1fr 90px 90px 110px 110px",
                    background: "#FAFAF6",
                    borderBottom: "1px solid var(--color-hairline)",
                    color: "var(--color-ink-400)",
                  }}
                >
                  <span>Description</span>
                  <span>Unit</span>
                  <span className="text-right">Default qty</span>
                  <span className="text-right">Default price</span>
                  <span className="text-right">Est. total</span>
                </div>
                {phase.lineItems.map((item, i) => (
                  <div
                    key={item.id}
                    className="grid gap-3 items-center px-5 py-3 hover:bg-[#FCFAF6] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 90px 90px 110px 110px",
                      borderBottom:
                        i < phase.lineItems.length - 1
                          ? "1px solid var(--color-hairline)"
                          : "none",
                    }}
                  >
                    <div className="text-[13px] font-medium text-ink-900 leading-[1.3] tracking-[-0.005em]">
                      {item.description}
                    </div>
                    <div className="text-[12px] text-ink-700">{item.unit}</div>
                    <div className="text-right text-[13px] text-ink-700 rd-tabular">
                      {item.defaultQuantity}
                    </div>
                    <div className="text-right text-[13px] text-ink-700 rd-tabular">
                      ${fmt(item.defaultPrice)}
                    </div>
                    <div className="text-right text-[13px] font-medium text-ink-900 rd-tabular">
                      ${fmt(item.defaultQuantity * item.defaultPrice)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated total */}
      <div>
        <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">
          {"// ESTIMATED DEFAULT TOTAL"}
        </p>
        <div
          className="bg-card-rd rounded-[14px] p-5"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <div className="max-w-xs ml-auto flex justify-between items-center">
            <span className="text-[13px] font-bold text-ink-900">Total</span>
            <span className="font-mono rd-tabular text-[16px] font-bold text-accent-rd">
              ${fmt(estimatedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

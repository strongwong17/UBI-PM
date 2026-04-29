import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus, Layers, ChevronRight } from "lucide-react";

export default async function TemplatesPage() {
  const templates = await prisma.estimateTemplate.findMany({
    include: {
      _count: { select: { phases: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div
        className="flex items-start justify-between gap-4 flex-wrap pb-[18px]"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] m-0 mb-1 text-ink-900">
            Estimate templates
          </h1>
          <p className="text-[13px] text-ink-500 mt-0.5 font-mono tracking-[0.02em]">
            {"// "}{templates.length} {templates.length === 1 ? "template" : "templates"}
          </p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{
            background: "var(--color-accent-rd)",
            boxShadow: "0 4px 12px -2px rgba(217, 82, 43, 0.32)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div
          className="bg-card-rd rounded-[14px] py-16 text-center"
          style={{
            border: "1px solid var(--color-hairline)",
            boxShadow: "0 1px 2px rgba(15, 23, 41, 0.04)",
          }}
        >
          <Layers className="h-10 w-10 text-ink-300 mx-auto mb-3" />
          <h3 className="text-[15px] font-medium text-ink-900 mb-1">No templates yet</h3>
          <p className="text-[13px] text-ink-500 mb-5 max-w-sm mx-auto">
            Reusable templates speed up estimate creation.
          </p>
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-ink-700 hover:bg-card-rd"
            style={{
              background: "var(--color-canvas-cool)",
              border: "1px solid var(--color-hairline-strong)",
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Create your first template
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {templates.map((template) => (
            <Link key={template.id} href={`/templates/${template.id}`} className="block group">
              <div
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-transparent transition-all duration-150 hover:border-hairline hover:bg-card-rd/80"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Layers className="h-4 w-4 text-ink-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-ink-900 truncate">
                        {template.name}
                      </p>
                      {!template.isActive && (
                        <span className="font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-ink-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-[12px] text-ink-500 truncate mt-0.5">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
                  <span className="text-[12px] text-ink-500 font-mono">
                    {template._count.phases} {template._count.phases === 1 ? "phase" : "phases"}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-500 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

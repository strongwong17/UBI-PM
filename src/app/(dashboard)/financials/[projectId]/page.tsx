import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currencySymbol } from "@/lib/currency";
import { loadOneProjectMargin } from "@/lib/financials";
import { isPassthroughRevenueLine } from "@/lib/margin";
import { CostLineEditor } from "@/components/financials/cost-line-editor";
import { BdOwnerSelect } from "@/components/financials/bd-owner-select";
import { ArrowLeft } from "lucide-react";

export default async function ProjectFinancialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { company: true } },
      businessDev: { select: { id: true } },
      estimates: {
        where: { isApproved: true, parentEstimateId: null },
        include: { phases: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
      },
      costLineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) notFound();

  const margin = (await loadOneProjectMargin(projectId))!;
  const sym = currencySymbol(margin.currency);
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const fmt = (n: number) => `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const revenueLines = project.estimates.flatMap((e) =>
    e.phases.flatMap((ph) =>
      ph.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        module: li.serviceModuleType,
        revenue: li.quantity * li.unitPrice,
        passthrough: isPassthroughRevenueLine({ serviceModuleType: li.serviceModuleType, isPassthrough: li.isPassthrough }),
      }))
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/financials" className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Financials
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-ink-900 m-0">
            {project.client.company} — {project.title}
          </h1>
          <BdOwnerSelect projectId={project.id} users={users} current={project.businessDev?.id ?? null} />
        </div>
      </div>

      {/* margin summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="// NET REVENUE" main={fmt(margin.plannedRevenue)} sub={`${fmt(margin.deliveredRevenue)} delivered`} />
        <SummaryCard label="// COST" main={fmt(margin.cost)} accent />
        <SummaryCard label="// MARGIN" main={`${fmt(margin.plannedMargin)} · ${margin.plannedMarginPct.toFixed(1)}%`} sub={`${fmt(margin.deliveredMargin)} · ${margin.deliveredMarginPct.toFixed(1)}% delivered`} good />
        <SummaryCard label="// PASSTHROUGH" main={fmt(margin.passthrough)} sub="incentives, excluded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue (read-only) */}
        <section>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// REVENUE · from approved estimate"}</p>
          <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
            {revenueLines.map((rl) => (
              <div key={rl.id} className={`flex justify-between py-2 text-[13px] ${rl.passthrough ? "text-ink-400" : "text-ink-900"}`} style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                <span>{rl.description}{rl.passthrough ? "  · passthrough" : ""}</span>
                <span className="font-mono rd-tabular">{rl.passthrough ? "excl." : fmt(rl.revenue)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold text-[13px]">
              <span>Net revenue</span>
              <span className="font-mono rd-tabular">{fmt(margin.plannedRevenue)}</span>
            </div>
          </div>
        </section>

        {/* Costs (editable) */}
        <section>
          <p className="font-mono text-[11px] font-bold text-ink-500 tracking-[0.06em] uppercase mb-3">{"// COSTS / EXPENSES"}</p>
          <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
            <CostLineEditor
              projectId={project.id}
              currencySymbol={sym}
              initial={project.costLineItems.map((c) => ({
                id: c.id,
                description: c.description,
                costType: c.costType,
                hours: c.hours,
                rate: c.rate,
                amount: c.amount,
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, main, sub, good, accent }: { label: string; main: string; sub?: string; good?: boolean; accent?: boolean }) {
  return (
    <div className="bg-card-rd rounded-[14px] p-4" style={{ border: "1px solid var(--color-hairline)" }}>
      <div className="font-mono text-[9px] font-bold tracking-[0.06em] uppercase text-ink-400 mb-1.5">{label}</div>
      <div className={`text-[18px] font-bold rd-tabular ${good ? "text-emerald-700" : accent ? "text-accent-rd" : "text-ink-900"}`}>{main}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

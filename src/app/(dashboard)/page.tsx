// src/app/(dashboard)/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleEstimates } from "@/lib/expire-stale-estimates";
import { HubTabBar, type HubKey } from "@/components/redesign/hub-tab-bar";
import { HubInquiry } from "@/components/redesign/hubs/hub-1-inquiry";
import { HubInProgress } from "@/components/redesign/hubs/hub-2-in-progress";
import { HubCompletion } from "@/components/redesign/hubs/hub-3-completion";
import { HubArchive } from "@/components/redesign/hubs/hub-4-archive";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ hub?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await expireStaleEstimates();
  } catch (err) {
    console.error("expireStaleEstimates failed:", err);
  }

  const { hub: hubParam } = await searchParams;
  const active: HubKey = (["inquiry", "in-progress", "completion", "archive"] as const).find(
    (k) => k === hubParam,
  ) ?? "inquiry";

  const allProjects = await prisma.project.findMany({
    include: {
      client: { select: { company: true } },
      estimates: {
        where: { deletedAt: null },
        include: { phases: { include: { lineItems: true } } },
      },
      invoices: { where: { deletedAt: null } },
      completion: { select: { internalCompleted: true, clientAcknowledged: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const allProjectsWithTotals = allProjects.map((p) => ({
    ...p,
    estimates: p.estimates.map((e) => {
      const subtotal = e.phases.reduce(
        (s, ph) => s + ph.lineItems.reduce((ss, li) => ss + li.quantity * li.unitPrice, 0),
        0,
      );
      const taxable = subtotal - (e.discount ?? 0);
      const tax = taxable * ((e.taxRate ?? 0) / 100);
      return { ...e, total: taxable + tax };
    }),
  }));

  const inquiryProjects = allProjectsWithTotals.filter((p) =>
    ["NEW", "BRIEFED", "ESTIMATING"].includes(p.status),
  );
  const inProgressProjects = allProjectsWithTotals.filter((p) => p.status === "IN_PROGRESS");
  const completionProjects = allProjectsWithTotals.filter((p) => p.status === "DELIVERED");
  const archiveProjects = allProjectsWithTotals.filter((p) =>
    ["CLOSED", "EXPIRED"].includes(p.status),
  );

  const userName = session.user.name?.split(" ")[0] ?? "there";

  const hubs = [
    {
      key: "inquiry" as const,
      label: "Inquiry",
      count: inquiryProjects.length,
      dotColor: "var(--color-s-estimating)",
      activeGlow: "#67D9FF",
    },
    {
      key: "in-progress" as const,
      label: "In Progress",
      count: inProgressProjects.length,
      dotColor: "var(--color-s-in-progress)",
      activeGlow: "#B5BCF8",
    },
    {
      key: "completion" as const,
      label: "Completion",
      count: completionProjects.length,
      dotColor: "var(--color-s-delivered)",
      activeGlow: "#6FE5BC",
    },
    {
      key: "archive" as const,
      label: "Archive",
      count: archiveProjects.length,
      dotColor: "var(--color-s-closed)",
      activeGlow: "#C4C2BC",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] leading-[1.2] mb-1">
            Hi, <span style={{ color: "var(--color-accent-rd)" }}>{userName}</span>
          </h1>
          <p className="font-mono text-[11px] text-ink-500 tracking-[0.02em]">
            {"// "}{new Date().toISOString().slice(0, 19).replace("T", " · ")} · 4 hubs active
          </p>
        </div>
      </div>

      <HubTabBar hubs={hubs} active={active} />

      {active === "inquiry" && (
        <HubInquiry projects={inquiryProjects} staleProjects={[]} />
      )}
      {active === "in-progress" && <HubInProgress projects={inProgressProjects} />}
      {active === "completion" && <HubCompletion projects={completionProjects} />}
      {active === "archive" && <HubArchive projects={archiveProjects} />}
    </div>
  );
}

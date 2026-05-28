import { prisma } from "@/lib/prisma";
import { computeProjectMargin, type MarginEstimate, type ProjectMargin } from "@/lib/margin";

const estimateInclude = {
  phases: {
    include: {
      lineItems: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          deliveredQuantity: true,
          percentageBasis: true,
          percentageRate: true,
          basisPhaseName: true,
          basisLineItemDesc: true,
          serviceModuleType: true,
          isPassthrough: true,
        },
      },
    },
  },
} as const;

// Loose structural shapes of the Prisma rows we read. Declared here (rather
// than importing generated Prisma types) so this adapter stays decoupled from
// the exact generated names while remaining fully typed.
interface RawLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  deliveredQuantity: number | null;
  percentageBasis: string | null;
  percentageRate: number | null;
  basisPhaseName: string | null;
  basisLineItemDesc: string | null;
  serviceModuleType: string | null;
  isPassthrough: boolean;
}
interface RawPhase {
  name: string;
  lineItems: RawLine[];
}
interface RawEstimate {
  isApproved: boolean;
  parentEstimateId: string | null;
  currency: string;
  phases: RawPhase[];
}

function toMarginEstimate(est: RawEstimate): MarginEstimate {
  return {
    isApproved: est.isApproved,
    parentEstimateId: est.parentEstimateId,
    currency: est.currency,
    phases: est.phases.map((p) => ({
      name: p.name,
      lineItems: p.lineItems.map((li) => ({
        ...li,
        deliveredQuantity: li.deliveredQuantity ?? null,
        percentageBasis: li.percentageBasis ?? null,
        percentageRate: li.percentageRate ?? null,
        basisPhaseName: li.basisPhaseName ?? null,
        basisLineItemDesc: li.basisLineItemDesc ?? null,
        serviceModuleType: li.serviceModuleType ?? null,
        isPassthrough: li.isPassthrough ?? false,
      })),
    })),
  };
}

export interface ProjectFinancialRow {
  projectId: string;
  projectNumber: string;
  title: string;
  status: string;
  clientId: string;
  company: string;
  ownerId: string | null;
  ownerName: string | null;
  margin: ProjectMargin;
}

/** All projects with at least one approved estimate, with margin computed.
 *  usdOnly restricts to USD primary-currency projects (company dashboard). */
export async function loadProjectFinancials(opts: { usdOnly?: boolean } = {}): Promise<ProjectFinancialRow[]> {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { id: true, company: true } },
      businessDev: { select: { id: true, name: true } },
      estimates: { include: estimateInclude },
      costLineItems: { select: { costType: true, hours: true, rate: true, amount: true } },
    },
  });

  const rows: ProjectFinancialRow[] = [];
  for (const p of projects) {
    const hasApproved = p.estimates.some((e) => e.isApproved && !e.parentEstimateId);
    if (!hasApproved) continue;
    const margin = computeProjectMargin({
      estimates: p.estimates.map(toMarginEstimate),
      costLineItems: p.costLineItems,
    });
    if (opts.usdOnly && margin.currency !== "USD") continue;
    rows.push({
      projectId: p.id,
      projectNumber: p.projectNumber,
      title: p.title,
      status: p.status,
      clientId: p.client.id,
      company: p.client.company,
      ownerId: p.businessDev?.id ?? null,
      ownerName: p.businessDev?.name ?? null,
      margin,
    });
  }
  return rows;
}

/** Single project's margin (detail page). Returns null if project missing. */
export async function loadOneProjectMargin(projectId: string): Promise<ProjectMargin | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      estimates: { include: estimateInclude },
      costLineItems: { select: { costType: true, hours: true, rate: true, amount: true } },
    },
  });
  if (!p) return null;
  return computeProjectMargin({
    estimates: p.estimates.map(toMarginEstimate),
    costLineItems: p.costLineItems,
  });
}

export function sumMargins(rows: ProjectFinancialRow[]) {
  const revenue = rows.reduce((s, r) => s + r.margin.plannedRevenue, 0);
  const delivered = rows.reduce((s, r) => s + r.margin.deliveredRevenue, 0);
  const cost = rows.reduce((s, r) => s + r.margin.cost, 0);
  const passthrough = rows.reduce((s, r) => s + r.margin.passthrough, 0);
  const margin = revenue - cost;
  return {
    revenue,
    delivered,
    cost,
    passthrough,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
    count: rows.length,
  };
}

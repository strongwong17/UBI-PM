// scripts/remap-project-status.ts
import { prisma } from "../src/lib/prisma";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const apply = process.argv.includes("--apply");

type Decision = {
  projectId: string;
  projectNumber: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
};

async function decide(project: {
  id: string;
  projectNumber: string;
  status: string;
  completion: { internalCompleted: boolean; clientAcknowledged: boolean } | null;
  inquiry: { objectives: string | null; serviceModules: { id: string }[] } | null;
  estimates: { isApproved: boolean }[];
}): Promise<Decision> {
  const old = project.status;
  let next: string;
  let reason: string;

  if (old === "CLOSED") { next = "CLOSED"; reason = "kept CLOSED"; }
  else if (project.completion?.internalCompleted && project.completion?.clientAcknowledged) {
    next = "DELIVERED"; reason = "both sign-offs present";
  } else if (old === "IN_PROGRESS") {
    next = "IN_PROGRESS"; reason = "preserved explicit IN_PROGRESS";
  } else if (project.estimates.some((e) => e.isApproved)) {
    next = "APPROVED"; reason = "approved estimate exists";
  } else if (project.estimates.length > 0) {
    next = "ESTIMATING"; reason = "estimate(s) exist";
  } else if ((project.inquiry?.objectives?.trim()?.length ?? 0) > 0 && (project.inquiry?.serviceModules?.length ?? 0) > 0) {
    next = "BRIEFED"; reason = "brief has objectives and service modules";
  } else {
    next = "NEW"; reason = "no brief / no estimates";
  }

  return { projectId: project.id, projectNumber: project.projectNumber, oldStatus: old, newStatus: next, reason };
}

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      completion: { select: { internalCompleted: true, clientAcknowledged: true } },
      inquiry: { select: { objectives: true, serviceModules: { select: { id: true } } } },
      estimates: { select: { isApproved: true } },
    },
  });

  const decisions = await Promise.all(projects.map(decide));
  const changed = decisions.filter((d) => d.oldStatus !== d.newStatus);

  console.log(`Total projects: ${projects.length}`);
  console.log(`Will change:    ${changed.length}`);
  console.table(changed.map((d) => ({
    PRJ: d.projectNumber,
    from: d.oldStatus,
    to: d.newStatus,
    reason: d.reason,
  })));

  if (!apply) {
    console.log("\n(dry-run) — pass --apply to write changes.");
    return;
  }

  // Backup BEFORE writing
  const backupDir = join(process.cwd(), "prisma", "backups");
  mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 10);
  const backupPath = join(backupDir, `status-remap-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(decisions, null, 2));
  console.log(`Backup written: ${backupPath}`);

  for (const d of changed) {
    await prisma.project.update({ where: { id: d.projectId }, data: { status: d.newStatus } });
  }
  console.log(`Updated ${changed.length} project(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });

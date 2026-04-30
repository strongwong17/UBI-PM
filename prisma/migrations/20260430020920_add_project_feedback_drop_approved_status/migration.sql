-- CreateTable
CREATE TABLE "ProjectFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "internalContent" TEXT,
    "internalSubmittedAt" TIMESTAMP(3),
    "internalSubmittedById" TEXT,
    "clientContent" TEXT,
    "clientSubmittedAt" TIMESTAMP(3),
    "clientSubmittedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFeedback_projectId_key" ON "ProjectFeedback"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_internalSubmittedById_fkey" FOREIGN KEY ("internalSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Data migration ──────────────────────────────────────
-- Drop the transient APPROVED project status: any project still parked there
-- jumps to IN_PROGRESS (which is now what estimate approval auto-sets).
UPDATE "Project" SET "status" = 'IN_PROGRESS' WHERE "status" = 'APPROVED';

-- Rename estimate "phase" labels that came from the old MODULE_TO_PHASE map
-- so they no longer collide visually with the executionPhase stepper.
-- Only renames exact matches; user-customized names are left alone.
UPDATE "EstimatePhase" SET "name" = 'Recruitment Costs'    WHERE "name" = 'Recruitment';
UPDATE "EstimatePhase" SET "name" = 'Fieldwork Costs'      WHERE "name" = 'Fieldwork';
UPDATE "EstimatePhase" SET "name" = 'Participant Incentives' WHERE "name" = 'Incentives';
UPDATE "EstimatePhase" SET "name" = 'Admin & Fees'         WHERE "name" = 'Administration';
UPDATE "EstimatePhase" SET "name" = 'Full Service Package' WHERE "name" = 'Full Service';

UPDATE "TemplatePhase" SET "name" = 'Recruitment Costs'    WHERE "name" = 'Recruitment';
UPDATE "TemplatePhase" SET "name" = 'Fieldwork Costs'      WHERE "name" = 'Fieldwork';
UPDATE "TemplatePhase" SET "name" = 'Participant Incentives' WHERE "name" = 'Incentives';
UPDATE "TemplatePhase" SET "name" = 'Admin & Fees'         WHERE "name" = 'Administration';
UPDATE "TemplatePhase" SET "name" = 'Full Service Package' WHERE "name" = 'Full Service';

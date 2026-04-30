-- Reverts the phase-label renames applied in
-- 20260430020920_add_project_feedback_drop_approved_status. The rename was
-- not what the user wanted; this restores the original "Phase" terminology.
-- Only renames exact matches (the same conditions as the original UPDATEs)
-- so anything a user customized stays untouched.

UPDATE "EstimatePhase" SET "name" = 'Recruitment'    WHERE "name" = 'Recruitment Costs';
UPDATE "EstimatePhase" SET "name" = 'Fieldwork'      WHERE "name" = 'Fieldwork Costs';
UPDATE "EstimatePhase" SET "name" = 'Incentives'     WHERE "name" = 'Participant Incentives';
UPDATE "EstimatePhase" SET "name" = 'Administration' WHERE "name" = 'Admin & Fees';
UPDATE "EstimatePhase" SET "name" = 'Full Service'   WHERE "name" = 'Full Service Package';

UPDATE "TemplatePhase" SET "name" = 'Recruitment'    WHERE "name" = 'Recruitment Costs';
UPDATE "TemplatePhase" SET "name" = 'Fieldwork'      WHERE "name" = 'Fieldwork Costs';
UPDATE "TemplatePhase" SET "name" = 'Incentives'     WHERE "name" = 'Participant Incentives';
UPDATE "TemplatePhase" SET "name" = 'Administration' WHERE "name" = 'Admin & Fees';
UPDATE "TemplatePhase" SET "name" = 'Full Service'   WHERE "name" = 'Full Service Package';

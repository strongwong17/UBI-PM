# Resume Prompt — Project Lifecycle Redesign

Paste the block below into a fresh Claude Code session started from inside the project directory:

```bash
cd /Users/ubi/Desktop/Internal_Tool/Project_Management_Tool/project-management-tool
claude
```

---

## Paste this:

```
Resume the project-lifecycle-redesign implementation. The spec and plan
are already written:

  Spec:  docs/superpowers/specs/2026-04-27-project-lifecycle-redesign-design.md
  Plan:  docs/superpowers/plans/2026-04-27-project-lifecycle-redesign.md

Use the superpowers:subagent-driven-development skill to execute the plan,
dispatching a fresh implementer subagent per task and running both reviews
(spec compliance, then code quality) between tasks.

Setup before Task 1:

1. Create a feature branch (do NOT work on main):
       git checkout -b redesign/project-lifecycle

   If a branch with that name already exists, use the existing one.

2. Confirm the working tree is clean. If there are uncommitted changes
   from the previous session (e.g. the spec/plan files, .superpowers/
   brainstorm artifacts), commit them on this branch with a message like
   "docs: project lifecycle redesign spec and plan" before starting Task 1.

3. Add the brainstorm scratch directory to .gitignore if not already
   ignored:
       .superpowers/

Important constraints (from CLAUDE.md and project memory):

- This is a production tool (https://pmt.ubinsights.com). All work in this
  plan happens locally only. Production deploy is a separate session and
  is NOT part of this run.
- The local DB (ubinsights_pmt on localhost) will receive an additive
  Prisma migration in Task 1 — two nullable columns. No drops, no resets.
- Never run `prisma migrate reset` or any destructive DB op.
- The data-migration script in Task 19 has a default dry-run flag and
  must be reviewed before --apply. For local execution that's fine; just
  don't run --apply on production from this session.
- The project has no test framework configured. Each task uses manual
  verification (npx tsc --noEmit, npm run build, dev server, curl,
  prisma studio) — the plan spells out the exact commands per task.

Workflow per task:

1. Read the task text from the plan file.
2. Dispatch a fresh implementer subagent with the full task text.
3. After the implementer finishes: dispatch a spec-compliance reviewer.
   Loop until ✅.
4. Then dispatch a code-quality reviewer. Loop until ✅.
5. Mark the task complete and move to the next.

Start with Task 1 (Phase 1 — schema additions). Proceed task-by-task
through Task 22, then run the final code-reviewer pass and stop. Do not
attempt to deploy.
```

---

## Where to resume from later

If you stop midway, tell the next session which task to resume from. The plan uses `- [ ]` checkboxes — Claude will track progress in TodoWrite and you can also tick the boxes manually in the plan file.

Example: *"Resume from Task 8 — earlier tasks are committed on `redesign/project-lifecycle`."*

## After all 22 tasks land

The plan ends with Task 22 (final smoke test). At that point the redesign is complete on the feature branch, with the local DB migrated and seeded data exercising the new flow. To deploy to production, start a separate session and reference the production-deploy notes in `CLAUDE.md` plus the dry-run procedure for the status-remap script in Task 19.

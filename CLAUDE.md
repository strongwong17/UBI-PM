# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project management tool for UBInsights — manages the full client engagement lifecycle, project-first.

---

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build (also runs TypeScript type-check)
npm run lint      # ESLint
npm run seed      # Seed the database (npx tsx prisma/seed.ts)

# Prisma
npx prisma migrate dev --name <migration-name>  # Create and apply a migration
npx prisma generate                              # Regenerate client after schema changes
npx prisma studio                                # Open database browser
```

**PostgreSQL note:** Database runs on PostgreSQL. Connection string is in `.env` (`DATABASE_URL`). Prisma 7 uses `@prisma/adapter-pg` driver adapter.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (TypeScript) |
| Database | PostgreSQL via Prisma 7 (`src/generated/prisma`), adapter: `@prisma/adapter-pg` |
| Auth | NextAuth v5 (JWT, Credentials provider) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Toasts | Sonner |
| PDF | @react-pdf/renderer v4 |
| Tables | @tanstack/react-table |
| Drag & drop | @dnd-kit (estimate/template phase reordering) |
| Excel export | exceljs |
| AI | openai SDK |

---

## Workflow (Project-First)

```
Project (created first)
  ├── Brief/Inquiry          (one child — research brief + service module checklist)
  ├── Estimate[]             (multiple versioned; one marked isApproved per project)
  ├── ProjectCompletion      (internal + client sign-off → flips status to DELIVERED)
  ├── ProjectFeedback        (open-ended internal + client retrospective)
  └── Invoice[]              (one per approved estimate; generated from confirmed actuals)
```

1. **Project** — created first from a client. Auto-generates `PRJ-YYYY-NNN` project number.
2. **Brief** — fill the brief tab: research objectives, methodology, service module checklist (RECRUITMENT, MODERATION, etc.).
3. **Estimate** — generate from service modules or build manually. Multiple versions allowed; multiple can be `isApproved` (e.g. one per country / currency).
4. **Approve estimate** — marks `isApproved:true` AND auto-flips project status straight to `IN_PROGRESS` (sets `startDate` if not already set). There is no longer a transient `APPROVED` status.
5. **Execution** — track research progress via `executionPhase` (Recruitment → Fieldwork → Analysis → Reporting). Manual selector.
6. **Delivery & Sign-off** — confirm actual delivered quantities per estimate, record internal + client sign-off (auto-flips status to `DELIVERED`), and submit open-ended Feedback (internal + client).
7. **Invoice** — generated from confirmed actuals on the Delivery & Sign-off tab. Multiple estimates → multiple invoices, one per estimate.
8. **Auto-archive** — when all of (status=DELIVERED) + (every non-deleted invoice = PAID) + (both feedback sides submitted) are true, project flips to `CLOSED` automatically. Helper: `src/lib/auto-archive.ts`.

---

## Architecture

- **Server components** fetch data directly via `prisma` (no fetch to own API)
- **Client components** (forms, interactive UI) call REST API routes via `fetch`
- Auth pattern: `import { auth } from "@/lib/auth"` — user ID accessed as `(session.user as any).id`, role as `(session.user as any).role`
- JWT stores `id` and `role`; session callbacks expose them on `session.user`
- Route groups: `src/app/(auth)/` for login, `src/app/(dashboard)/` for all app pages
- DB connection via `DATABASE_URL` env var → `@prisma/adapter-pg` in `src/lib/prisma.ts`
- Middleware (`src/middleware.ts`) protects all routes

---

## Enums & Status Values

### Project statuses (6 stages)

`NEW → BRIEFED → ESTIMATING → IN_PROGRESS → DELIVERED → CLOSED`

Transitions:
- `NEW → BRIEFED` (auto): brief saved with objectives + ≥1 service module
- `BRIEFED → ESTIMATING` (auto): first estimate generated or sent
- `ESTIMATING → IN_PROGRESS` (auto): any estimate approved (sets `startDate`)
- `IN_PROGRESS → DELIVERED` (auto): both internal + client sign-off recorded
- `DELIVERED → CLOSED` (auto): all invoices PAID + both feedback sides submitted (`checkAndAutoArchive`)
- Manual PATCH to `/api/projects/[id]` is still accepted for edge cases.

### Other enums (in `src/types/index.ts`)

| Enum | Values |
|------|--------|
| ExecutionPhase | RECRUITMENT, FIELDWORK, ANALYSIS, REPORTING |
| ServiceModuleType | RECRUITMENT, MODERATION, SIMULTANEOUS_TRANSLATION, PROJECT_MANAGEMENT, INCENTIVES, VENUE, REPORTING, LOGISTICS |
| EstimateStatus | DRAFT, SENT, APPROVED, REJECTED |
| InvoiceStatus | DRAFT, SENT, PAID, OVERDUE |
| InquirySource | WECHAT, EMAIL, LARK, OTHER |
| PricingModel | HOURLY, FIXED_PHASE, DELIVERABLE, MIXED |

`StatusBadge` in `src/components/shared/status-badge.tsx` handles coloring — add new statuses there if needed.

---

## Key Data Model Details

- **Client** — primary field is `company String` (not `name`). Has `billingName`, `billingAddress`, `billingEmail`, `billingPhone`, `taxId`, `industry`.
- **Project** — `projectNumber String @unique` (format `PRJ-YYYY-NNN`). Client access via `project.client`.
- **Estimate** — `projectId` (not inquiryId). `isApproved Boolean` can be true on multiple estimates per project (e.g. USD + CNY for different markets). `version` auto-increments per project.
- **Invoice** — `projectId` (NOT @unique — multiple invoices per project allowed, one per estimate). `estimateId` links to source estimate. Client accessed via `project.client`. Has `paidDate DateTime?`. Soft-deleted via `deletedAt`.
- **Inquiry** — `projectId @unique` (one per project, child of Project). Has `serviceModules InquiryServiceModule[]`.
- **ProjectCompletion** — `projectId @unique`. Tracks `internalCompleted` + `clientAcknowledged` booleans with timestamps. Both true → project status auto-flips to DELIVERED.
- **ProjectFeedback** — `projectId @unique`. Open-ended `internalContent` + `clientContent` text fields plus submission timestamps. Both submitted (combined with all-paid invoices) trigger auto-archive.

---

## Pages & Routes

### Sidebar nav order
Dashboard → Projects → Estimates → Invoices → Clients | Admin: Templates, Settings

### Project Hub (`/projects/[id]`)
5 tabs in lifecycle order: **Overview** | **Estimates** | **Execution** | **Delivery & Sign-off** | **Invoices**
- Tab state synced to `?tab=` URL param. Brief lives inside Overview (ClientSignalsPanel).
- Tab values: `overview`, `estimates`, `execution`, `completion` (Delivery & Sign-off), `invoice`.
- Estimates tab: version list with approve/duplicate/⋯ actions. Approving auto-starts the project.
- Execution tab: manual `executionPhase` selector (Recruitment → Fieldwork → Analysis → Reporting).
- Delivery & Sign-off tab: confirm actuals per estimate (chip-row picker shows invoice status per estimate when multiple), internal + client sign-off, open-ended feedback section. "Confirm & generate draft invoice" creates the Invoice from confirmed actuals.
- Invoices tab: BillingSummary (Estimated/Delivered/Invoiced/Paid) + per-estimate "awaiting invoice" rows that link to Delivery & Sign-off pre-selected to that estimate + existing invoice rows.
- Linking from the Invoices tab to a specific estimate uses `?tab=completion&estimate=<id>`.

---

## API Routes

### Projects
- `POST /api/projects` — requires `{ clientId, title, primaryContactId? }`; auto-generates `PRJ-YYYY-NNN`
- `GET /api/projects/[id]` — full graph (inquiry+modules, estimates, invoices, completion, feedback, client+contacts)
- `PATCH /api/projects/[id]` — accepts `{ status, executionPhase, title, notes, assignedToId, primaryContactId, startDate, endDate }`. Auto-sets `startDate` on first transition to IN_PROGRESS.
- `POST /api/projects/[id]/generate-estimate` — maps service modules → phases+line items, creates new versioned Estimate
- `POST /api/projects/[id]/invoices` — creates Invoice from a specific estimate, supports `mode: SLICE | PERCENT | FLAT`
- `GET/PATCH /api/projects/[id]/inquiry` — upsert inquiry + service modules
- `GET/PATCH /api/projects/[id]/completion` — upsert ProjectCompletion. Both signoffs → status=DELIVERED + auto-archive check.
- `GET/PUT /api/projects/[id]/feedback` — upsert ProjectFeedback (`internalContent`, `clientContent` + submit toggles). Submitting either side triggers auto-archive check.
- `PATCH /api/projects/[id]/delivery` — record delivered quantities per estimate line item.

### Estimates
- `PATCH /api/estimates/[id]/approve` — toggle approval. On approve, project status auto-jumps to IN_PROGRESS (and sets startDate). On unapprove, rolls back to ESTIMATING only if no other approvals exist AND project is not already past start.
- `PATCH /api/estimates/[id]/status` — valid: DRAFT, SENT, APPROVED, REJECTED; SENT advances project from NEW/BRIEFED → ESTIMATING.

### Invoices
- `PATCH /api/invoices/[id]` — PAID sets `paidDate`. Triggers `checkAndAutoArchive` (closes project if DELIVERED + all invoices PAID + dual feedback submitted).

### PDF routes (all return `application/pdf`)
- `GET /api/estimates/[id]/pdf`
- `GET /api/invoices/[id]/pdf`

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `src/components/projects/project-hub-tabs.tsx` | URL-synced tab wrapper (`?tab=` param) |
| `src/components/projects/project-status-stepper.tsx` | 8-step status stepper with PATCH |
| `src/components/projects/inquiry-brief-form.tsx` | Full brief form + service module checklist |
| `src/components/projects/service-module-checklist.tsx` | Checkbox grid; checked item expands inline |
| `src/components/projects/generate-estimate-button.tsx` | POST generate-estimate → redirect to estimates tab |
| `src/components/projects/generate-invoice-button.tsx` | POST generate-invoice with confirmation |
| `src/components/estimates/estimate-builder.tsx` | Full estimate editor (phases, line items, template picker, dnd-kit) |
| `src/components/estimates/estimate-approve-button.tsx` | Approve estimate with confirmation dialog |
| `src/components/templates/template-builder.tsx` | Same UX as estimate-builder for templates |
| `src/lib/pdf/estimate-pdf.tsx` | @react-pdf/renderer Document for estimates (uses `project.client.company`) |
| `src/lib/pdf/invoice-pdf.tsx` | @react-pdf/renderer Document for invoices (uses `project.client`) |

---

## Roles

| Role | Access |
|------|--------|
| ADMIN | All pages including Templates and Settings |
| MANAGER | All workflow pages |
| VIEWER | Read-only access |

---

## Environment Variables (`.env`)

```
DATABASE_URL="postgresql://ubi@localhost:5432/ubinsights_pmt"
AUTH_SECRET="..."        # NextAuth v5 secret
AUTH_URL="http://localhost:3000"
```

---

## Common Patterns

### PDF generation in API route
```ts
import { renderToBuffer } from "@react-pdf/renderer";
const buffer = await renderToBuffer(React.createElement(MyPDF, { data }) as any);
const uint8 = new Uint8Array(buffer);
return new NextResponse(uint8, { headers: { "Content-Type": "application/pdf" } });
```

### Date fields in Server → Client component props
Prisma returns `Date` objects; client components expect `string`. Transform before passing:
```ts
initialData={project.inquiry ? {
  ...project.inquiry,
  desiredStartDate: project.inquiry.desiredStartDate?.toISOString() ?? null,
} : undefined}
```

### Adding a new shadcn component
```bash
npx shadcn@latest add <component-name> --yes
```

---

## Production Deployment

**URL:** https://pmt.ubinsights.com
**VM:** GCP `internal-tools` in `us-central1-c` (Debian 12, 2GB RAM, no external IP)
**SSH:** `gcloud compute ssh internal-tools --zone=us-central1-c`
**App dir:** `/opt/ubinsights-pmt` (standalone build)
**Build dir:** `/tmp/ubi-pm-build` (git clone, used for builds)
**Process:** PM2 process `ubinsights-pmt` on port 3002
**Tunnel:** Cloudflare Tunnel → `localhost:3002`
**DB:** PostgreSQL 15, user `ubinsights`, db `ubinsights_pmt`
**Backups:** `/home/yushi_ubinsights_com/backups/`

### Deploy flow

```bash
# 1. Pull latest code on server
cd /tmp/ubi-pm-build && git pull origin main

# 2. Build
npm run build

# 3. Copy standalone build (NEVER overwrite ecosystem.config.cjs)
sudo rsync -a --delete .next/standalone/ /opt/ubinsights-pmt/ \
  --exclude ecosystem.config.cjs --exclude logs --exclude uploads
sudo rsync -a --delete .next/static/ /opt/ubinsights-pmt/.next/static/
sudo rsync -a public/ /opt/ubinsights-pmt/public/
sudo rsync -a prisma/ /opt/ubinsights-pmt/prisma/
sudo cp prisma.config.ts /opt/ubinsights-pmt/prisma.config.ts
sudo cp package.json /opt/ubinsights-pmt/package.json

# 4. Apply migrations (NEVER drop the database)
DATABASE_URL='...' npx prisma migrate deploy

# 5. Restart
cd /opt/ubinsights-pmt && pm2 restart ecosystem.config.cjs && pm2 save
```

### Production database rules

- **NEVER drop or recreate the production database.** Only run `prisma migrate deploy`.
- **NEVER run `prisma migrate reset`** or `DROP DATABASE` on production.
- **NEVER seed production** unless explicitly asked — seed is for local dev / initial setup only.
- **NEVER overwrite `ecosystem.config.cjs`** on the server — it contains production env vars (DATABASE_URL, AUTH_SECRET, AUTH_URL, AUTH_TRUST_HOST) that are NOT in the repo.
- **Always ask for permission** before any destructive database operation on production.
- **Table ownership** must be `ubinsights` (not `postgres`) for migrations to succeed.

---

## Tests

No test framework is configured.

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
  ├── Brief/Inquiry (one child — research brief + service module checklist)
  ├── Estimate[] (multiple versioned; one marked isApproved)
  ├── Invoice (one, generated from approved estimate)
  └── ProjectCompletion (formal sign-off)
```

1. **Project** — created first from a client. Auto-generates `PRJ-YYYY-NNN` project number.
2. **Brief** — fill the inquiry/brief tab: research objectives, methodology, service module checklist (RECRUITMENT, MODERATION, etc.).
3. **Estimate** — generate from service modules or build manually. Multiple versions allowed; one is `isApproved`.
4. **Approve Estimate** — marks `isApproved:true`, sets project status to `APPROVED`.
5. **Invoice** — generated from the approved estimate via project hub. One invoice per project.
6. **Completion** — `ProjectCompletion` records internal + client sign-off.

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

### Project statuses (8 stages)

`INQUIRY_RECEIVED → ESTIMATE_SENT → APPROVED → IN_PROGRESS → COMPLETED → INVOICED → PAID → CLOSED`

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
- **Estimate** — `projectId` (not inquiryId). `isApproved Boolean` marks the single approved version. `version` auto-increments per project.
- **Invoice** — `projectId @unique` (one per project). `estimateId @unique`. Client accessed via `project.client` (no direct `clientId`). Has `paidDate DateTime?`.
- **Inquiry** — `projectId @unique` (one per project, child of Project). Has `serviceModules InquiryServiceModule[]`.

---

## Pages & Routes

### Sidebar nav order
Dashboard → Projects → Estimates → Invoices → Clients | Admin: Templates, Settings

### Project Hub (`/projects/[id]`)
6 tabs: **Overview** | **Brief** | **Estimates** | **Invoice** | **Execution** | **Completion**
- Tab state synced to `?tab=` URL param
- Brief tab: InquiryBriefForm (all brief fields + service module checklist)
- Estimates tab: version list + approve/duplicate/status actions + generate-from-modules button
- Invoice tab: generate button (from approved estimate) or invoice card with status
- Execution tab: 4-phase selector (only active when IN_PROGRESS)
- Completion tab: internal + client sign-off form

---

## API Routes

### Projects
- `POST /api/projects` — requires `{ clientId, title, primaryContactId? }`; auto-generates `PRJ-YYYY-NNN`
- `GET /api/projects/[id]` — full graph (inquiry+modules, estimates, invoice, completion, client+contacts)
- `PATCH /api/projects/[id]` — accepts `{ status, executionPhase, title, notes, assignedToId, primaryContactId }`
- `POST /api/projects/[id]/generate-estimate` — maps service modules → phases+line items, creates new versioned Estimate
- `POST /api/projects/[id]/generate-invoice` — reads approved estimate, creates Invoice (409 if exists)
- `GET/PATCH /api/projects/[id]/inquiry` — upsert inquiry + service modules
- `GET/PATCH /api/projects/[id]/completion` — upsert ProjectCompletion

### Estimates
- `PATCH /api/estimates/[id]/approve` — transaction: clears isApproved on all project estimates, sets this one, sets project status to APPROVED
- `PATCH /api/estimates/[id]/status` — valid: DRAFT, SENT, APPROVED, REJECTED; SENT also sets project status to ESTIMATE_SENT

### Invoices
- `PATCH /api/invoices/[id]` — PAID sets `paidDate` + project status to PAID

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

## Tests

No test framework is configured.

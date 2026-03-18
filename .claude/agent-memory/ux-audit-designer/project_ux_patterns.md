---
name: UBInsights PMT UX Patterns & Conventions
description: Component patterns, design conventions, navigation structure, and recurring UX patterns from March 2026 post-redesign audit
type: project
---

## Design System (Post-Redesign, March 2026)

### New Pattern (Applied To: Dashboard, Projects, Estimates, Invoices, Clients, Activity)
- Page header: `text-2xl font-bold text-gray-900` + `text-sm text-gray-500 mt-0.5` subtitle
- Filter chips: `rounded-full`, `text-[12px]`, `bg-gray-900 text-white border-gray-900` when selected, `bg-white text-gray-600 border-gray-200` when unselected
- Filter row label: `text-xs font-medium text-gray-400 uppercase tracking-wider` with fixed-width prefix
- List items: borderless rows with `px-4 py-3 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50/80`
- Empty states: icon `h-10 w-10` + title (font-medium text-gray-500) + subtitle (text-sm text-gray-400) + optional CTA
- Results section: `text-sm font-semibold text-gray-900` heading + Badge count
- Root spacing: `space-y-5` on redesigned list pages
- Color system: `text-gray-*` throughout (gray-100 through gray-900)

### Old Pattern (Contracts + Contract Templates -- NOT redesigned)
- Uses `text-zinc-*` color system with `dark:` mode variants
- Uses `bg-blue-600` for primary buttons (custom, not shadcn Button)
- Uses `rounded-xl` border pattern instead of Card component
- Custom filter bar (not filter chips): segmented button group `bg-zinc-100`
- Custom search input with zinc styling
- No shadcn Button, Input, Select components -- all hand-rolled
- Delete confirmation inline (not AlertDialog)

### Partially Updated Pages (Use new header, old body)
- `/templates` (Estimate Templates list) -- has `text-sm text-gray-500 mt-1` (old mt-1 vs mt-0.5), uses Card wrapping each list item, uses ChevronRight instead of ArrowRight, uses `space-y-6` instead of `space-y-5`, Button has no `size="sm"`, empty state icon is h-12 (not h-10)
- `/templates/[id]` (detail) -- old-style Card+CardHeader+CardTitle wrapping, `mt-1` subtitle pattern
- `/settings` -- old `text-gray-500 mt-1` subtitle, uses CardHeader>CardTitle>CardDescription pattern (fine for forms)
- `/estimates/new` -- subtitle uses `text-gray-500 mt-1` (missing `text-sm`)
- `/estimates/[id]/edit` -- subtitle uses `text-gray-500 mt-1` (missing `text-sm`)
- `/clients/[id]` -- subtitle uses `text-gray-500 mt-1` (missing `text-sm`)

## Dead Code
- `src/components/layout/header.tsx` -- Header component exists but is NOT imported anywhere (removed from layout.tsx during redesign)
- References to old route titles in header.tsx: `/inquiries` (page deleted), `/contracts` (uses different design)

## Status Badge Color Collisions
- DRAFT (gray-100) = CLOSED (gray-100) = ARCHIVED (gray-100) -- three statuses share same color
- SENT estimate (indigo-100) = ESTIMATE_SENT project (indigo-100) -- same color, different contexts (acceptable)
- REJECTED (red-100) = OVERDUE (red-100) = CANCELLED (red-100) -- three statuses share same color

## Spacing Inconsistencies
- Redesigned list pages use `space-y-5`: Projects, Estimates, Invoices, Clients, Activity
- Non-redesigned pages use `space-y-6`: Templates, Settings, detail pages, form pages
- Dashboard uses `space-y-6` (acceptable, different page type)

**Why:** Captured during March 2026 post-design-system audit to track remaining inconsistencies.
**How to apply:** Use this to identify which pages still need alignment to the new design system.

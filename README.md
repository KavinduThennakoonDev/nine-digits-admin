# Nine Digits Admin

Internal management platform for Nine Digits — Next.js 16 (App Router, Cache Components), MongoDB Atlas + Mongoose, Tailwind 4 + shadcn/ui.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI and the SEED_ADMIN_* values
npm run seed                 # roles, settings, indexes, first Super Admin (idempotent)
npm run dev
```

The first Super Admin signs in with `SEED_ADMIN_PASSWORD` and must choose a new password immediately.
There is no public sign-up or email: admins create accounts and reset passwords from **Users**.

## Deploy (Vercel)

1. Add `MONGODB_URI` under Project → Settings → Environment Variables.
2. In Atlas → Network Access, allow Vercel to connect (`0.0.0.0/0`, since Vercel has no fixed IPs on most plans).
3. Run `npm run seed` once against the production database (already done if you seeded locally with the same URI).

### Reminders (Vercel Cron)

Time-based notifications (follow-ups due or overdue, overdue invoices, project deadlines) are created by `/api/cron/reminders`:

1. In Vercel → Project → Settings → Environment Variables, add `CRON_SECRET` (any long random string, e.g. `openssl rand -hex 32`).
2. `vercel.json` schedules the job daily at 02:00 UTC (7:30 AM in Sri Lanka). The Hobby plan allows daily cron jobs.
3. Between cron runs, the app also refreshes reminders on its own (at most every 10 minutes) whenever someone has it open.

Reminders are idempotent: each has a unique key per person, so they're never sent twice.

### Production checklist

Before each deploy:

1. `npm run check` passes (typecheck, lint, unit tests) and `npm run build` succeeds.
2. Vercel has `MONGODB_URI` and `CRON_SECRET` set for Production.
3. After upgrading, run `npm run seed` against production once to sync new indexes. It's idempotent and never overwrites your data.

After deploying:

- `GET /api/health` should return `{"ok":true,"db":"up"}`. Point an uptime monitor at it; it reveals nothing else.
- Errors show a reference code (the error digest). Search for it in Vercel → Logs to find the full stack trace.
- Atlas: keep backups enabled (Atlas → Backup), and rotate the database password if it was ever shared.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest): money and invoice maths, periods and time zones, permissions, redirect and injection guards, lead statuses, custom-field parsing |
| `npm run check` | Typecheck + lint + unit tests (run before every deploy) |
| `npm run seed` | Bootstrap roles, settings, indexes and the first Super Admin. Re-run after upgrades to sync new indexes |
| `npm run reset-admin` | Recover the Super Admin account if you're locked out |

## Architecture

```
src/
  app/(auth)/        sign-in
  app/(app)/         authenticated shell (sidebar, top bar) + modules
  components/        ui (shadcn), layout, data-table, forms, feedback
  features/<module>/ actions.ts (Server Actions) · queries.ts · schemas.ts (Zod) · components/
  server/            db (connection, models), auth (session, DAL), services (audit), action wrapper
  lib/               permissions catalog, constants, formatting, list params
  proxy.ts           optimistic cookie gate (real checks happen in server/auth/dal.ts)
```

- **Auth:** opaque session cookie (httpOnly) → SHA-256 hash stored in `sessions` (TTL index). Passwords use bcrypt; 5 failed attempts lock an account for 15 minutes. Password resets, suspension and password changes revoke existing sessions.
- **RBAC:** permission keys live in `src/lib/permissions.ts`. Roles bundle them; users can get per-permission allow/deny overrides. Every query and action calls `authorize()`; the UI only hides what you can't use.
- **Sign-in protection:** 5 failed attempts lock an account for 15 minutes, and each network (IP) gets at most 30 sign-in attempts per 15 minutes (`server/services/rate-limit.ts`, stored in MongoDB so it holds across serverless instances). After sign-in, only same-site paths are accepted as redirect targets.
- **Headers:** `next.config.ts` sends a Content Security Policy (no third-party origins, no framing), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a locked-down permissions policy, `noindex`, and HSTS on Vercel. API responses are `Cache-Control: private, no-store`.
- **Input:** every Server Action validates input with Zod and checks ids before querying, so Mongo operators can't be injected. Search text is regex-escaped, and CSV/Excel exports neutralise spreadsheet formulas.
- **Audit:** important changes are written to `activitylogs` with before/after diffs.
- **Work visibility:** without `projects.view_all` you see projects you manage, belong to or created; without `tasks.view_all`, tasks assigned to or created by you.
- **Row-level visibility:** without `clients.view_all` / `leads.view_all`, people only see records assigned to them (`server/auth/scope.ts`); records they create are assigned to them automatically.
- **Money:** stored as integer minor units (cents) plus currency (`lib/money.ts`). Forms send amounts as text and the server converts them.
- **Time zones:** servers run in UTC. Instants are formatted in `Asia/Colombo`, and date-only fields (contract dates, lead date) are stored as UTC midnight (`lib/format.ts`).
- **History is never lost:** clients and leads are archived or soft-deleted (`deletedAt`). Converting a lead runs in a MongoDB transaction, keeps the lead and its full activity history, and links it to the new client.

## Modules

| Module | Highlights |
| --- | --- |
| Leads | Configurable pipeline (Settings → Lead statuses) · calls (outcome and duration), WhatsApp, email, meetings and notes on one timeline · follow-up reminders with overdue highlighting · quick status changes · conversion to client · CSV/Excel export of the current filters (`/api/export/leads`) |
| Clients | Profile with contact, engagement, services, retainer and contract dates · activity and communication timeline (includes the original lead's history) · archive/restore |
| Services | Catalogue with billing type and base price, used by clients and leads |
| Settings | Agency details, reporting currency and exchange rate, invoice numbering, lead statuses (rename, recolour, reorder, add, mark as closed, remove with lead re-assignment) |
| Finance | Invoices (line items, discount, tax, sequential `ND-YYYY-0001` numbers, print/PDF) · payments (partial, multiple, refunds) · expenses with custom categories · overview with revenue vs expenses, P&L by month/quarter/year |
| Projects | Client, services, budget vs linked expenses, dates, manager and members, status, priority, task progress, activity history with notes |
| Tasks | List and board views, multiple assignees, due dates, priority, comments, full history. Assignees can move and comment on their own tasks |
| Team | Directory and profiles: role, workload (tasks, projects, clients, leads) and activity history. Accounts and permissions stay under Users |
| Reports | 8 reports (clients, leads, conversion, revenue, expenses, P&L, projects, employee performance) with date ranges and CSV/Excel export |
| Notifications | In-app bell and page; new leads, assignments, payments, follow-up/invoice/deadline reminders; per-person mute settings |
| Activity log | Every important change with user, module, record, previous and new values; filters and CSV export |
| Custom tables | Build tables without code: 14 field types, generated forms/columns/validation, search, filters, sorting, CSV import (validate first), CSV/Excel export, per-role access |

### Custom table rules

- Table definitions (`dynamictables`, with embedded field metadata) are stored separately from rows (`dynamicrecords`).
- Record values live under the field's immutable `id` (`data.fld_xxx`), never its label or key, so renaming fields or options never touches records.
- Field behaviour (validation, form input, display, CSV parsing, conversion) comes from a single registry: `src/lib/dynamic/registry.ts`.
- Deleting a field archives it, and every record keeps its value. Permanent deletion is a separate, type-to-confirm action on archived fields.
- Changing a field's type runs a dry-run preview first, then converts in a transaction. Values that can't be converted move to `record.legacy[fieldId]` and are flagged in the UI until someone fixes them.
- Access: `tables.manage` gives full control. Otherwise each table has a default level (none/view/edit) for people with `tables.view`, plus per-role overrides.

### Lead status rules

- Statuses live in Settings (`leadStatuses`). Leads store the status **key**, which never changes, so renaming a status updates every screen, export and report without touching leads.
- “New” and “Converted” are built in. They can be renamed and recoloured but not removed. Only the conversion flow sets “Converted”.
- **Closed** statuses mean the lead is finished: they don't count as open or overdue and get no follow-up reminders.
- Removing a status that still holds leads requires choosing where they go. The move runs in a transaction and adds a note to each lead's history.

### Finance rules

- Invoices, payments and expenses are separate collections. Revenue means **completed payments**; issued invoices are tracked as receivables.
- An invoice's `amountPaid` and status are recalculated from its payments, in a transaction, every time a payment is recorded, edited or refunded. Overpaying is rejected.
- Payments are never deleted, only marked refunded or failed. Invoices with payments can't be voided until those payments are refunded, and only drafts can be deleted.
- Once an invoice has payments, its amounts, client and currency are locked; only the due date, notes and terms can change.
- "Overdue" is derived (unpaid and past the due date), never stored.
- Every financial record stores its own `usdToLkr` rate snapshot. Reports convert to the reporting currency (Settings) with that snapshot, so changing the rate never changes historic figures.

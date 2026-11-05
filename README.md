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

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run seed` | Bootstrap roles, settings, indexes and the first Super Admin |

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
- **Audit:** important changes are written to `activitylogs` with before/after diffs.
- **Row-level visibility:** without `clients.view_all` / `leads.view_all`, people only see records assigned to them (`server/auth/scope.ts`); records they create are assigned to them automatically.
- **Money:** stored as integer minor units (cents) plus currency (`lib/money.ts`). Forms send amounts as text and the server converts them.
- **Time zones:** servers run in UTC. Instants are formatted in `Asia/Colombo`, and date-only fields (contract dates, lead date) are stored as UTC midnight (`lib/format.ts`).
- **History is never lost:** clients and leads are archived or soft-deleted (`deletedAt`). Converting a lead runs in a MongoDB transaction, keeps the lead and its full activity history, and links it to the new client.

## Modules

| Module | Highlights |
| --- | --- |
| Leads | Calls (outcome and duration), WhatsApp, email, meetings and notes on one timeline · follow-up reminders with overdue highlighting · quick status changes · conversion to client · CSV/Excel export of the current filters (`/api/export/leads`) |
| Clients | Profile with contact, engagement, services, retainer and contract dates · activity and communication timeline (includes the original lead's history) · archive/restore |
| Services | Catalogue with billing type and base price, used by clients and leads |
| Finance | Invoices (line items, discount, tax, sequential `ND-YYYY-0001` numbers, print/PDF) · payments (partial, multiple, refunds) · expenses with custom categories · overview with revenue vs expenses, P&L by month/quarter/year |

### Finance rules

- Invoices, payments and expenses are separate collections. Revenue means **completed payments**; issued invoices are tracked as receivables.
- An invoice's `amountPaid` and status are recalculated from its payments, in a transaction, every time a payment is recorded, edited or refunded. Overpaying is rejected.
- Payments are never deleted, only marked refunded or failed. Invoices with payments can't be voided until those payments are refunded, and only drafts can be deleted.
- Once an invoice has payments, its amounts, client and currency are locked; only the due date, notes and terms can change.
- "Overdue" is derived (unpaid and past the due date), never stored.
- Every financial record stores its own `usdToLkr` rate snapshot. Reports convert to the reporting currency (Settings) with that snapshot, so changing the rate never changes historic figures.

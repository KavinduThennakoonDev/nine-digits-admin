import "server-only";
import { getLeadStatuses } from "@/server/services/lead-statuses";
import { closedStatusKeys, statusLabel } from "@/lib/lead-statuses";
import { connectDB } from "@/server/db/connect";
import { Client } from "@/server/db/models/client";
import { Lead } from "@/server/db/models/lead";
import { LeadActivity } from "@/server/db/models/lead-activity";
import { Payment } from "@/server/db/models/payment";
import { Invoice } from "@/server/db/models/invoice";
import { Expense } from "@/server/db/models/expense";
import { ExpenseCategory } from "@/server/db/models/expense-category";
import { Project } from "@/server/db/models/project";
import { Task } from "@/server/db/models/task";
import { User } from "@/server/db/models/user";
import { Role } from "@/server/db/models/role";
import { getFx, toBase, toBaseExpr } from "@/server/services/fx";
import { getReceivablesSummary } from "@/features/invoices/queries";
import {
  CLIENT_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS, LEAD_SOURCE_OPTIONS, OPEN_PROJECT_STATUSES,
  OPEN_TASK_STATUSES, PAYMENT_METHOD_OPTIONS, PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS, labelOf, type Currency,
} from "@/lib/constants";
import { APP_TIMEZONE, startOfAgencyDay } from "@/lib/format";
import { agencyYearMonth, rangeMatch } from "@/lib/periods";
import type { Permission } from "@/lib/permissions";

/* ── Report shape ────────────────────────────────────────── */

export type ColumnType = "text" | "number" | "money" | "percent" | "date";
export type ReportTable = {
  title: string;
  columns: { key: string; label: string; type: ColumnType }[];
  /** money = minor units in `base`; date = ISO string; percent = 0..1. */
  rows: Record<string, string | number | null>[];
  /** Optional totals row (same keys). */
  totals?: Record<string, string | number | null>;
};
export type TrendChart = { kind: "trend"; title: string; format: "money" | "number"; series: { key: string; label: string }[]; points: Record<string, string | number | null>[] };
export type BarsChart = { kind: "bars"; title: string; format: "money" | "number" | "percent"; rows: { id: string; name: string; value: number; hint?: string }[] };
export type ReportResult = {
  base: Currency;
  stats: { label: string; value: string | number; format: ColumnType; hint?: string }[];
  charts: (TrendChart | BarsChart)[];
  tables: ReportTable[];
};
export type Range = { from: Date | null; to: Date | null; label: string };

export const REPORTS = [
  { key: "clients", label: "Clients", description: "Client base, growth and retainers", permission: "reports.view" },
  { key: "leads", label: "Leads", description: "Lead volume by source, status and country", permission: "reports.view" },
  { key: "conversion", label: "Lead conversion", description: "Which sources and people convert leads", permission: "reports.view" },
  { key: "revenue", label: "Revenue", description: "Money received, by client, method and month", permission: "reports.finance" },
  { key: "expenses", label: "Expenses", description: "Spending by category and month", permission: "reports.finance" },
  { key: "pnl", label: "Profit & loss", description: "Revenue, expenses and profit per month", permission: "reports.finance" },
  { key: "projects", label: "Projects", description: "Delivery status, deadlines and budgets", permission: "reports.view" },
  { key: "employees", label: "Employee performance", description: "Leads, conversions and tasks per person", permission: "reports.view" },
] as const satisfies readonly { key: string; label: string; description: string; permission: Permission }[];
export type ReportKey = (typeof REPORTS)[number]["key"];

/* ── Helpers ─────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (field: string) => ({ $dateToString: { format: "%Y-%m", date: field, timezone: APP_TIMEZONE } });
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** Month buckets covering the range (capped at 24); all-time → last 12 months. */
function monthBuckets(range: Range) {
  const end = range.to ? new Date(range.to.getTime() - 1) : new Date();
  const endYm = agencyYearMonth(end);
  const startYm = range.from ? agencyYearMonth(range.from) : { year: endYm.year, month: endYm.month - 11 };
  const out: { key: string; label: string }[] = [];
  let y = startYm.year + Math.floor(startYm.month / 12);
  let m = ((startYm.month % 12) + 12) % 12;
  while ((y < endYm.year || (y === endYm.year && m <= endYm.month)) && out.length < 24) {
    out.push({ key: ym(y, m), label: `${MONTHS[m]} ${String(y).slice(2)}` });
    m++; if (m === 12) { m = 0; y++; }
  }
  return out.length ? out : [{ key: ym(endYm.year, endYm.month), label: `${MONTHS[endYm.month]} ${String(endYm.year).slice(2)}` }];
}

async function countByMonth(model: { aggregate: typeof Lead.aggregate }, match: Record<string, unknown>, field: string, sum: unknown = 1) {
  const rows = await model.aggregate<{ _id: string; v: number }>([{ $match: match }, { $group: { _id: monthKey(`$${field}`), v: { $sum: sum } } }]);
  return new Map(rows.map((r) => [r._id, r.v]));
}

const within = (field: string, range: Range) => {
  const m = rangeMatch(range);
  return m ? { [field]: m } : {};
};
const pct = (a: number, b: number) => (b ? a / b : 0);
async function namesOf(model: "user" | "client", ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, string>();
  const docs = model === "user"
    ? await User.find({ _id: { $in: unique } }, { name: 1 }).lean().then((d) => d.map((x) => [String(x._id), x.name] as const))
    : await Client.find({ _id: { $in: unique } }, { clientName: 1 }).lean().then((d) => d.map((x) => [String(x._id), x.clientName] as const));
  return new Map(docs);
}
function groupCount<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/* ── Reports ─────────────────────────────────────────────── */

async function clientsReport(range: Range): Promise<ReportResult> {
  const { base, usdToLkr } = await getFx();
  const live = { deletedAt: null };
  const [all, created, growth] = await Promise.all([
    Client.find({ ...live, archivedAt: null }, { status: 1, clientType: 1, country: 1, monthlyRetainer: 1 }).lean(),
    Client.find({ ...live, ...within("createdAt", range) }).sort({ createdAt: -1 }).limit(2000).lean(),
    countByMonth(Client, { ...live, ...within("createdAt", range) }, "createdAt"),
  ]);
  const retained = all.filter((c) => c.monthlyRetainer?.amount);
  const mrr = retained.reduce((s, c) => s + toBase(c.monthlyRetainer!.amount!, (c.monthlyRetainer!.currency ?? "LKR") as Currency, usdToLkr, base), 0);
  const managers = await namesOf("user", created.map((c) => c.assignedTo));
  return {
    base,
    stats: [
      { label: "Current clients", value: all.length, format: "number", hint: `${all.filter((c) => c.status === "active").length} active` },
      { label: `New clients (${range.label})`, value: created.length, format: "number" },
      { label: "On a retainer", value: retained.length, format: "number" },
      { label: "Monthly retainers", value: mrr, format: "money", hint: "Recurring per month, current clients" },
    ],
    charts: [
      { kind: "trend", title: "New clients per month", format: "number", series: [{ key: "clients", label: "New clients" }],
        points: monthBuckets(range).map((b) => ({ label: b.label, clients: growth.get(b.key) ?? 0 })) },
      { kind: "bars", title: "Current clients by status", format: "number", rows: groupCount(all, (c) => c.status as string).map(([k, v]) => ({ id: k, name: labelOf(CLIENT_STATUS_OPTIONS, k), value: v })) },
      { kind: "bars", title: "By country", format: "number", rows: groupCount(all, (c) => c.country || "Not set").slice(0, 8).map(([k, v]) => ({ id: k, name: k, value: v })) },
    ],
    tables: [{
      title: `Clients added (${range.label})`,
      columns: [
        { key: "name", label: "Client", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "type", label: "Type", type: "text" },
        { key: "manager", label: "Account manager", type: "text" }, { key: "country", label: "Country", type: "text" },
        { key: "retainer", label: "Monthly retainer", type: "money" }, { key: "created", label: "Added", type: "date" },
      ],
      rows: created.map((c) => ({
        name: c.clientName, status: labelOf(CLIENT_STATUS_OPTIONS, c.status), type: labelOf(CLIENT_TYPE_OPTIONS, c.clientType),
        manager: c.assignedTo ? managers.get(String(c.assignedTo)) ?? "" : "Unassigned", country: c.country ?? "",
        retainer: c.monthlyRetainer?.amount ? toBase(c.monthlyRetainer.amount, (c.monthlyRetainer.currency ?? "LKR") as Currency, usdToLkr, base) : null,
        created: (c.createdAt as Date).toISOString(),
      })),
    }],
  };
}

async function leadsReport(range: Range): Promise<ReportResult> {
  const match = { deletedAt: null, ...within("leadDate", range) };
  const [leads, perMonth] = await Promise.all([
    Lead.find(match).sort({ leadDate: -1 }).limit(5000).lean(),
    countByMonth(Lead, match, "leadDate"),
  ]);
  const [owners, statuses] = await Promise.all([namesOf("user", leads.map((l) => l.assignedTo)), getLeadStatuses()]);
  const closed = closedStatusKeys(statuses);
  const converted = leads.filter((l) => l.status === "converted").length;
  const open = leads.filter((l) => !closed.includes(l.status as string)).length;
  const order = new Map(statuses.map((s, i) => [s.key, i]));
  return {
    base: (await getFx()).base,
    stats: [
      { label: `Leads (${range.label})`, value: leads.length, format: "number" },
      { label: "Still open", value: open, format: "number" },
      { label: "Converted", value: converted, format: "number" },
      { label: "Conversion rate", value: pct(converted, leads.length), format: "percent" },
    ],
    charts: [
      { kind: "trend", title: "Leads per month", format: "number", series: [{ key: "leads", label: "Leads" }],
        points: monthBuckets(range).map((b) => ({ label: b.label, leads: perMonth.get(b.key) ?? 0 })) },
      { kind: "bars", title: "By source", format: "number", rows: groupCount(leads, (l) => l.source as string).map(([k, v]) => ({ id: k, name: labelOf(LEAD_SOURCE_OPTIONS, k), value: v })) },
      { kind: "bars", title: "By status", format: "number", rows: groupCount(leads, (l) => l.status as string).sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99)).map(([k, v]) => ({ id: k, name: statusLabel(statuses, k), value: v })) },
      { kind: "bars", title: "By country", format: "number", rows: groupCount(leads, (l) => l.country || "Not set").slice(0, 8).map(([k, v]) => ({ id: k, name: k, value: v })) },
    ],
    tables: [{
      title: `Leads (${range.label})`,
      columns: [
        { key: "name", label: "Lead", type: "text" }, { key: "source", label: "Source", type: "text" }, { key: "status", label: "Status", type: "text" },
        { key: "owner", label: "Assigned to", type: "text" }, { key: "country", label: "Country", type: "text" },
        { key: "leadDate", label: "Lead date", type: "date" }, { key: "lastContact", label: "Last contact", type: "date" },
      ],
      rows: leads.map((l) => ({
        name: l.fullName, source: labelOf(LEAD_SOURCE_OPTIONS, l.source), status: statusLabel(statuses, l.status as string),
        owner: l.assignedTo ? owners.get(String(l.assignedTo)) ?? "" : "Unassigned", country: l.country ?? "",
        leadDate: (l.leadDate as Date).toISOString(), lastContact: l.lastContactedAt?.toISOString() ?? null,
      })),
    }],
  };
}

async function conversionReport(range: Range): Promise<ReportResult> {
  const leads = await Lead.find({ deletedAt: null, ...within("leadDate", range) }, { source: 1, status: 1, assignedTo: 1, leadDate: 1, convertedAt: 1 }).lean();
  const [owners, statuses] = await Promise.all([namesOf("user", leads.map((l) => l.assignedTo)), getLeadStatuses()]);
  const closed = closedStatusKeys(statuses);
  const reached = (s: string) => !["new", "not_contacted"].includes(s);
  const lostStatus = (s: string) => s !== "converted" && closed.includes(s);
  const summarise = (key: (l: (typeof leads)[number]) => string, label: (k: string) => string) =>
    [...new Set(leads.map(key))].map((k) => {
      const group = leads.filter((l) => key(l) === k);
      const conv = group.filter((l) => l.status === "converted");
      const days = conv.filter((l) => l.convertedAt).map((l) => (l.convertedAt!.getTime() - (l.leadDate as Date).getTime()) / 86_400_000);
      return {
        name: label(k), leads: group.length, contacted: group.filter((l) => reached(l.status as string)).length, converted: conv.length,
        lost: group.filter((l) => lostStatus(l.status as string)).length,
        rate: pct(conv.length, group.length), days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      };
    }).sort((a, b) => b.converted - a.converted || b.leads - a.leads);
  const bySource = summarise((l) => l.source as string, (k) => labelOf(LEAD_SOURCE_OPTIONS, k));
  const byOwner = summarise((l) => (l.assignedTo ? String(l.assignedTo) : "none"), (k) => (k === "none" ? "Unassigned" : owners.get(k) ?? "Unknown"));
  const converted = leads.filter((l) => l.status === "converted");
  const days = converted.filter((l) => l.convertedAt).map((l) => (l.convertedAt!.getTime() - (l.leadDate as Date).getTime()) / 86_400_000);
  const columns: ReportTable["columns"] = [
    { key: "name", label: "", type: "text" }, { key: "leads", label: "Leads", type: "number" }, { key: "contacted", label: "Contacted", type: "number" },
    { key: "converted", label: "Converted", type: "number" }, { key: "lost", label: "Closed, not converted", type: "number" },
    { key: "rate", label: "Conversion rate", type: "percent" }, { key: "days", label: "Avg. days to convert", type: "number" },
  ];
  return {
    base: (await getFx()).base,
    stats: [
      { label: `Leads (${range.label})`, value: leads.length, format: "number" },
      { label: "Contacted", value: leads.filter((l) => reached(l.status as string)).length, format: "number", hint: `${Math.round(pct(leads.filter((l) => reached(l.status as string)).length, leads.length) * 100)}% reached` },
      { label: "Converted", value: converted.length, format: "number", hint: `${Math.round(pct(converted.length, leads.length) * 100)}% conversion rate` },
      { label: "Avg. days to convert", value: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : "—", format: "number" },
    ],
    charts: [
      { kind: "bars", title: "Conversion rate by source", format: "percent", rows: bySource.filter((s) => s.leads).map((s) => ({ id: s.name, name: s.name, value: s.rate, hint: `${s.converted}/${s.leads}` })) },
      { kind: "bars", title: "Conversions by person", format: "number", rows: byOwner.filter((o) => o.converted).map((o) => ({ id: o.name, name: o.name, value: o.converted })) },
    ],
    tables: [
      { title: "By source", columns: columns.map((c) => (c.key === "name" ? { ...c, label: "Source" } : c)), rows: bySource },
      { title: "By person", columns: columns.map((c) => (c.key === "name" ? { ...c, label: "Assigned to" } : c)), rows: byOwner },
    ],
  };
}

async function revenueReport(range: Range): Promise<ReportResult> {
  const { base } = await getFx();
  const match = { status: "completed" as const, ...within("paymentDate", range) };
  const [payments, perMonth, receivables] = await Promise.all([
    Payment.find(match).sort({ paymentDate: -1 }).limit(5000).lean(),
    countByMonth(Payment, match, "paymentDate", toBaseExpr(base)),
    getReceivablesSummary(),
  ]);
  const clients = await namesOf("client", payments.map((p) => p.clientId));
  const invoices = await Invoice.find({ _id: { $in: payments.map((p) => p.invoiceId).filter(Boolean) } }, { number: 1 }).lean();
  const inv = new Map(invoices.map((i) => [String(i._id), i.number]));
  const inBase = (p: (typeof payments)[number]) => toBase(p.amount, p.currency as Currency, p.usdToLkr, base);
  const total = payments.reduce((s, p) => s + inBase(p), 0);
  const sumBy = (key: (p: (typeof payments)[number]) => string) => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(key(p), (m.get(key(p)) ?? 0) + inBase(p));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    base,
    stats: [
      { label: `Revenue (${range.label})`, value: total, format: "money" },
      { label: "Payments", value: payments.length, format: "number" },
      { label: "Average payment", value: payments.length ? Math.round(total / payments.length) : 0, format: "money" },
      { label: "Outstanding now", value: receivables.outstanding, format: "money", hint: `${receivables.overdueCount} overdue invoice(s)` },
    ],
    charts: [
      { kind: "trend", title: "Revenue per month", format: "money", series: [{ key: "revenue", label: "Revenue" }],
        points: monthBuckets(range).map((b) => ({ label: b.label, revenue: perMonth.get(b.key) ?? 0 })) },
      { kind: "bars", title: "By client", format: "money", rows: sumBy((p) => String(p.clientId)).slice(0, 10).map(([k, v]) => ({ id: k, name: clients.get(k) ?? "Deleted client", value: v })) },
      { kind: "bars", title: "By payment method", format: "money", rows: sumBy((p) => p.method as string).map(([k, v]) => ({ id: k, name: labelOf(PAYMENT_METHOD_OPTIONS, k), value: v })) },
    ],
    tables: [{
      title: `Payments received (${range.label})`,
      columns: [
        { key: "date", label: "Date", type: "date" }, { key: "client", label: "Client", type: "text" }, { key: "invoice", label: "Invoice", type: "text" },
        { key: "method", label: "Method", type: "text" }, { key: "reference", label: "Reference", type: "text" },
        { key: "original", label: "Amount", type: "text" }, { key: "amount", label: `Amount (${base})`, type: "money" },
      ],
      rows: payments.map((p) => ({
        date: p.paymentDate.toISOString(), client: clients.get(String(p.clientId)) ?? "Deleted client",
        invoice: p.invoiceId ? inv.get(String(p.invoiceId)) ?? "" : "Standalone", method: labelOf(PAYMENT_METHOD_OPTIONS, p.method),
        reference: p.reference ?? "", original: `${p.currency} ${(p.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, amount: inBase(p),
      })),
      totals: { date: "Total", amount: total },
    }],
  };
}

async function expensesReport(range: Range): Promise<ReportResult> {
  const { base } = await getFx();
  const match = { deletedAt: null, ...within("expenseDate", range) };
  const [expenses, perMonth, cats] = await Promise.all([
    Expense.find(match).sort({ expenseDate: -1 }).limit(5000).lean(),
    countByMonth(Expense, match, "expenseDate", toBaseExpr(base)),
    ExpenseCategory.find({}, { name: 1 }).lean(),
  ]);
  const catName = new Map(cats.map((c) => [String(c._id), c.name]));
  const clients = await namesOf("client", expenses.map((e) => e.clientId));
  const inBase = (e: (typeof expenses)[number]) => toBase(e.amount, e.currency as Currency, e.usdToLkr, base);
  const total = expenses.reduce((s, e) => s + inBase(e), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(String(e.categoryId), (byCat.get(String(e.categoryId)) ?? 0) + inBase(e));
  const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  return {
    base,
    stats: [
      { label: `Expenses (${range.label})`, value: total, format: "money" },
      { label: "Entries", value: expenses.length, format: "number" },
      { label: "Largest category", value: catRows[0] ? catName.get(catRows[0][0]) ?? "—" : "—", format: "text", hint: catRows[0] ? `${Math.round(pct(catRows[0][1], total) * 100)}% of spend` : undefined },
      { label: "Client-related", value: expenses.filter((e) => e.clientId).reduce((s, e) => s + inBase(e), 0), format: "money" },
    ],
    charts: [
      { kind: "trend", title: "Expenses per month", format: "money", series: [{ key: "expenses", label: "Expenses" }],
        points: monthBuckets(range).map((b) => ({ label: b.label, expenses: perMonth.get(b.key) ?? 0 })) },
      { kind: "bars", title: "By category", format: "money", rows: catRows.map(([k, v]) => ({ id: k, name: catName.get(k) ?? "Uncategorised", value: v })) },
    ],
    tables: [{
      title: `Expenses (${range.label})`,
      columns: [
        { key: "date", label: "Date", type: "date" }, { key: "name", label: "Expense", type: "text" }, { key: "category", label: "Category", type: "text" },
        { key: "client", label: "Client", type: "text" }, { key: "method", label: "Paid by", type: "text" }, { key: "amount", label: `Amount (${base})`, type: "money" },
      ],
      rows: expenses.map((e) => ({
        date: e.expenseDate.toISOString(), name: e.name, category: catName.get(String(e.categoryId)) ?? "", client: e.clientId ? clients.get(String(e.clientId)) ?? "" : "",
        method: labelOf(PAYMENT_METHOD_OPTIONS, e.method), amount: inBase(e),
      })),
      totals: { date: "Total", amount: total },
    }],
  };
}

async function pnlReport(range: Range): Promise<ReportResult> {
  const { base } = await getFx();
  const [rev, exp] = await Promise.all([
    countByMonth(Payment, { status: "completed", ...within("paymentDate", range) }, "paymentDate", toBaseExpr(base)),
    countByMonth(Expense, { deletedAt: null, ...within("expenseDate", range) }, "expenseDate", toBaseExpr(base)),
  ]);
  const rows = monthBuckets(range).map((b) => {
    const revenue = rev.get(b.key) ?? 0;
    const expenses = exp.get(b.key) ?? 0;
    return { label: b.label, revenue, expenses, profit: revenue - expenses, margin: revenue ? (revenue - expenses) / revenue : null };
  });
  // Totals come from the whole range, not just the visible buckets.
  const revenue = [...rev.values()].reduce((a, b) => a + b, 0);
  const expenses = [...exp.values()].reduce((a, b) => a + b, 0);
  return {
    base,
    stats: [
      { label: `Revenue (${range.label})`, value: revenue, format: "money" },
      { label: "Expenses", value: expenses, format: "money" },
      { label: "Net profit", value: revenue - expenses, format: "money" },
      { label: "Margin", value: revenue ? (revenue - expenses) / revenue : 0, format: "percent" },
    ],
    charts: [{ kind: "trend", title: "Revenue vs expenses", format: "money", series: [{ key: "revenue", label: "Revenue" }, { key: "expenses", label: "Expenses" }], points: rows }],
    tables: [{
      title: "Monthly profit & loss",
      columns: [
        { key: "label", label: "Month", type: "text" }, { key: "revenue", label: "Revenue", type: "money" }, { key: "expenses", label: "Expenses", type: "money" },
        { key: "profit", label: "Net profit", type: "money" }, { key: "margin", label: "Margin", type: "percent" },
      ],
      rows,
      totals: { label: "Total", revenue, expenses, profit: revenue - expenses, margin: revenue ? (revenue - expenses) / revenue : null },
    }],
  };
}

async function projectsReport(range: Range): Promise<ReportResult> {
  const { base, usdToLkr } = await getFx();
  const today = startOfAgencyDay();
  const [projects, completed] = await Promise.all([
    Project.find({ deletedAt: null }).lean(),
    Project.countDocuments({ deletedAt: null, status: "completed", ...within("completedAt", range) }),
  ]);
  const ids = projects.map((p) => p._id);
  const [spent, tasks, clients, managers] = await Promise.all([
    Expense.aggregate<{ _id: unknown; t: number }>([{ $match: { projectId: { $in: ids }, deletedAt: null } }, { $group: { _id: "$projectId", t: { $sum: toBaseExpr(base) } } }]),
    Task.aggregate<{ _id: unknown; total: number; done: number }>([
      { $match: { projectId: { $in: ids }, deletedAt: null, status: { $ne: "cancelled" } } },
      { $group: { _id: "$projectId", total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } } } },
    ]),
    namesOf("client", projects.map((p) => p.clientId)),
    namesOf("user", projects.map((p) => p.managerId)),
  ]);
  const spentMap = new Map(spent.map((s) => [String(s._id), s.t]));
  const taskMap = new Map(tasks.map((t) => [String(t._id), t]));
  const open = projects.filter((p) => OPEN_PROJECT_STATUSES.includes(p.status as never));
  const overdue = open.filter((p) => p.deadline && p.deadline < today);
  const rows = projects
    .filter((p) => OPEN_PROJECT_STATUSES.includes(p.status as never) || (p.completedAt && (!range.from || (p.completedAt >= range.from && (!range.to || p.completedAt < range.to)))))
    .map((p) => {
      const budget = p.budget?.amount == null ? null : toBase(p.budget.amount, (p.budget.currency ?? "LKR") as Currency, usdToLkr, base);
      const s = spentMap.get(String(p._id)) ?? 0;
      const t = taskMap.get(String(p._id));
      return {
        name: p.name, client: p.clientId ? clients.get(String(p.clientId)) ?? "" : "Internal", manager: p.managerId ? managers.get(String(p.managerId)) ?? "" : "",
        status: labelOf(PROJECT_STATUS_OPTIONS, p.status), priority: labelOf(PRIORITY_OPTIONS, p.priority),
        deadline: p.deadline?.toISOString() ?? null, tasks: t ? `${t.done}/${t.total}` : "0/0", progress: t?.total ? t.done / t.total : 0,
        budget, spent: s, variance: budget === null ? null : budget - s,
      };
    });
  return {
    base,
    stats: [
      { label: "Active projects", value: open.length, format: "number" },
      { label: "Overdue", value: overdue.length, format: "number", hint: "Open and past the deadline" },
      { label: `Completed (${range.label})`, value: completed, format: "number" },
      { label: "Over budget", value: rows.filter((r) => r.variance !== null && r.variance < 0).length, format: "number" },
    ],
    charts: [
      { kind: "bars", title: "Projects by status", format: "number", rows: groupCount(projects, (p) => p.status as string).map(([k, v]) => ({ id: k, name: labelOf(PROJECT_STATUS_OPTIONS, k), value: v })) },
    ],
    tables: [{
      title: "Active projects and those completed in the period",
      columns: [
        { key: "name", label: "Project", type: "text" }, { key: "client", label: "Client", type: "text" }, { key: "manager", label: "Manager", type: "text" },
        { key: "status", label: "Status", type: "text" }, { key: "deadline", label: "Deadline", type: "date" }, { key: "tasks", label: "Tasks done", type: "text" },
        { key: "progress", label: "Progress", type: "percent" }, { key: "budget", label: "Budget", type: "money" }, { key: "spent", label: "Spent", type: "money" },
        { key: "variance", label: "Remaining", type: "money" },
      ],
      rows,
    }],
  };
}

async function employeesReport(range: Range): Promise<ReportResult> {
  const today = startOfAgencyDay();
  const [users, roles] = await Promise.all([User.find({ status: "active" }, { name: 1, roleId: 1, jobTitle: 1 }).sort({ name: 1 }).lean(), Role.find({}, { name: 1 }).lean()]);
  const roleName = new Map(roles.map((r) => [String(r._id), r.name]));
  const by = async (model: { aggregate: typeof Lead.aggregate }, match: Record<string, unknown>, field: string) => {
    const rows = await model.aggregate<{ _id: unknown; n: number }>([
      { $match: match }, ...(field.endsWith("Ids") ? [{ $unwind: `$${field}` }] : []), { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.n]));
  };
  const [leads, converted, contacts, tasksDone, tasksOpen, tasksOverdue] = await Promise.all([
    by(Lead, { deletedAt: null, ...within("leadDate", range) }, "assignedTo"),
    by(Lead, { deletedAt: null, status: "converted", ...within("convertedAt", range) }, "assignedTo"),
    by(LeadActivity, { type: { $in: ["call", "whatsapp", "email", "meeting"] }, ...within("occurredAt", range) }, "userId"),
    by(Task, { deletedAt: null, status: "done", ...within("completedAt", range) }, "assigneeIds"),
    by(Task, { deletedAt: null, status: { $in: OPEN_TASK_STATUSES } }, "assigneeIds"),
    by(Task, { deletedAt: null, status: { $in: OPEN_TASK_STATUSES }, dueDate: { $lt: today } }, "assigneeIds"),
  ]);
  const rows = users.map((u) => {
    const id = String(u._id);
    const l = leads.get(id) ?? 0;
    const c = converted.get(id) ?? 0;
    return {
      name: u.name, role: u.jobTitle || roleName.get(String(u.roleId)) || "", leads: l, contacts: contacts.get(id) ?? 0, converted: c,
      rate: l ? c / l : null, tasksDone: tasksDone.get(id) ?? 0, tasksOpen: tasksOpen.get(id) ?? 0, overdue: tasksOverdue.get(id) ?? 0,
    };
  });
  const sum = (k: "contacts" | "converted" | "tasksDone") => rows.reduce((s, r) => s + r[k], 0);
  return {
    base: (await getFx()).base,
    stats: [
      { label: "Active team members", value: users.length, format: "number" },
      { label: `Calls & messages logged (${range.label})`, value: sum("contacts"), format: "number" },
      { label: "Leads converted", value: sum("converted"), format: "number" },
      { label: "Tasks completed", value: sum("tasksDone"), format: "number" },
    ],
    charts: [
      { kind: "bars", title: "Tasks completed", format: "number", rows: rows.filter((r) => r.tasksDone).sort((a, b) => b.tasksDone - a.tasksDone).map((r) => ({ id: r.name, name: r.name, value: r.tasksDone })) },
      { kind: "bars", title: "Calls & messages logged", format: "number", rows: rows.filter((r) => r.contacts).sort((a, b) => b.contacts - a.contacts).map((r) => ({ id: r.name, name: r.name, value: r.contacts })) },
    ],
    tables: [{
      title: `Performance (${range.label})`,
      columns: [
        { key: "name", label: "Person", type: "text" }, { key: "role", label: "Role", type: "text" }, { key: "leads", label: "New leads", type: "number" },
        { key: "contacts", label: "Calls & messages", type: "number" }, { key: "converted", label: "Converted", type: "number" },
        { key: "rate", label: "Conversion", type: "percent" }, { key: "tasksDone", label: "Tasks done", type: "number" },
        { key: "tasksOpen", label: "Open tasks", type: "number" }, { key: "overdue", label: "Overdue tasks", type: "number" },
      ],
      rows,
    }],
  };
}

const RUNNERS: Record<ReportKey, (r: Range) => Promise<ReportResult>> = {
  clients: clientsReport, leads: leadsReport, conversion: conversionReport, revenue: revenueReport,
  expenses: expensesReport, pnl: pnlReport, projects: projectsReport, employees: employeesReport,
};

export async function runReport(key: ReportKey, range: Range): Promise<ReportResult> {
  await connectDB();
  return RUNNERS[key](range);
}

export const isReportKey = (k: string | undefined): k is ReportKey => REPORTS.some((r) => r.key === k);

import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Payment } from "@/server/db/models/payment";
import { Expense } from "@/server/db/models/expense";
import { ExpenseCategory } from "@/server/db/models/expense-category";
import { Invoice } from "@/server/db/models/invoice";
import { Client } from "@/server/db/models/client";
import { getFx, toBaseExpr } from "@/server/services/fx";
import { getReceivablesSummary, displayStatus } from "@/features/invoices/queries";
import { agencyYearMonth, periodMatch, type Period } from "@/lib/periods";
import { APP_TIMEZONE } from "@/lib/format";
import type { Currency } from "@/lib/constants";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const monthKey = (field: string) => ({ $dateToString: { format: "%Y-%m", date: field, timezone: APP_TIMEZONE } });

/** Sums amounts (converted to the reporting currency) per agency-time month. */
async function sumByMonth(kind: "payments" | "expenses", match: Record<string, unknown>, base: Currency) {
  const pipeline = [
    { $match: match },
    { $group: { _id: monthKey(kind === "payments" ? "$paymentDate" : "$expenseDate"), total: { $sum: toBaseExpr(base) } } },
  ];
  const rows =
    kind === "payments"
      ? await Payment.aggregate<{ _id: string; total: number }>(pipeline)
      : await Expense.aggregate<{ _id: string; total: number }>(pipeline);
  return new Map(rows.map((r) => [r._id, r.total]));
}

export async function getFinanceOverview(period: Period) {
  await connectDB();
  const { base } = await getFx();
  const range = periodMatch(period);
  const payMatch = { status: "completed", ...(range ? { paymentDate: range } : {}) };
  const expMatch = { deletedAt: null, ...(range ? { expenseDate: range } : {}) };
  const invMatch = { deletedAt: null, status: { $nin: ["draft", "void"] }, ...(range ? { issueDate: range } : {}) };

  const [rev, exp, inv, receivables] = await Promise.all([
    Payment.aggregate<{ total: number; n: number }>([{ $match: payMatch }, { $group: { _id: null, total: { $sum: toBaseExpr(base) }, n: { $sum: 1 } } }]),
    Expense.aggregate<{ total: number; n: number }>([{ $match: expMatch }, { $group: { _id: null, total: { $sum: toBaseExpr(base) }, n: { $sum: 1 } } }]),
    Invoice.aggregate<{ total: number; n: number }>([{ $match: invMatch }, { $group: { _id: null, total: { $sum: toBaseExpr(base, "$total") }, n: { $sum: 1 } } }]),
    getReceivablesSummary(),
  ]);
  const revenue = rev[0]?.total ?? 0;
  const expenses = exp[0]?.total ?? 0;
  return {
    base,
    revenue,
    paymentCount: rev[0]?.n ?? 0,
    expenses,
    expenseCount: exp[0]?.n ?? 0,
    profit: revenue - expenses,
    margin: revenue > 0 ? (revenue - expenses) / revenue : null,
    invoiced: inv[0]?.total ?? 0,
    invoiceCount: inv[0]?.n ?? 0,
    receivables,
  };
}

export type MonthPoint = { key: string; label: string; revenue: number; expenses: number; profit: number };

/** The last 12 calendar months (agency time), oldest first, including empty months. */
export async function getMonthlySeries(): Promise<{ base: Currency; points: MonthPoint[] }> {
  await connectDB();
  const { base } = await getFx();
  const range = periodMatch("last_12_months");
  const [rev, exp] = await Promise.all([
    sumByMonth("payments", { status: "completed", paymentDate: range }, base),
    sumByMonth("expenses", { deletedAt: null, expenseDate: range }, base),
  ]);
  const { year, month } = agencyYearMonth();
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    const key = ym(d.getUTCFullYear(), d.getUTCMonth());
    const revenue = rev.get(key) ?? 0;
    const expenses = exp.get(key) ?? 0;
    points.push({ key, label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, revenue, expenses, profit: revenue - expenses });
  }
  return { base, points };
}

export async function getExpensesByCategory(period: Period) {
  await connectDB();
  const { base } = await getFx();
  const range = periodMatch(period);
  const rows = await Expense.aggregate<{ _id: unknown; total: number }>([
    { $match: { deletedAt: null, ...(range ? { expenseDate: range } : {}) } },
    { $group: { _id: "$categoryId", total: { $sum: toBaseExpr(base) } } },
    { $sort: { total: -1 } },
  ]);
  const cats = await ExpenseCategory.find({ _id: { $in: rows.map((r) => r._id) } }, { name: 1 }).lean();
  const names = new Map(cats.map((c) => [String(c._id), c.name]));
  return { base, rows: rows.map((r) => ({ id: String(r._id), name: names.get(String(r._id)) ?? "Uncategorised", total: r.total })) };
}

export async function getRevenueByClient(period: Period, limit = 8) {
  await connectDB();
  const { base } = await getFx();
  const range = periodMatch(period);
  const rows = await Payment.aggregate<{ _id: unknown; total: number; n: number }>([
    { $match: { status: "completed", ...(range ? { paymentDate: range } : {}) } },
    { $group: { _id: "$clientId", total: { $sum: toBaseExpr(base) }, n: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: limit },
  ]);
  const clients = await Client.find({ _id: { $in: rows.map((r) => r._id) } }, { clientName: 1 }).lean();
  const names = new Map(clients.map((c) => [String(c._id), c.clientName]));
  return { base, rows: rows.map((r) => ({ id: String(r._id), name: names.get(String(r._id)) ?? "Deleted client", total: r.total, payments: r.n })) };
}

export async function getOverdueInvoices(limit = 6) {
  await connectDB();
  const docs = await Invoice.find({ deletedAt: null, status: { $in: ["sent", "partial"] }, dueDate: { $lt: new Date() } })
    .sort({ dueDate: 1 }).limit(limit * 2).lean();
  const overdue = docs.filter((d) => displayStatus(d.status as string, d.dueDate) === "overdue").slice(0, limit);
  const clients = await Client.find({ _id: { $in: overdue.map((d) => d.clientId) } }, { clientName: 1 }).lean();
  const names = new Map(clients.map((c) => [String(c._id), c.clientName]));
  return overdue.map((i) => ({
    id: String(i._id), number: i.number, clientName: names.get(String(i.clientId)) ?? "Deleted client",
    dueDate: i.dueDate.toISOString(), balance: i.total - i.amountPaid, currency: i.currency as Currency,
  }));
}

export async function getRecentPayments(limit = 6) {
  await connectDB();
  const docs = await Payment.find({ status: "completed" }).sort({ paymentDate: -1, createdAt: -1 }).limit(limit).lean();
  const [clients, invoices] = await Promise.all([
    Client.find({ _id: { $in: docs.map((d) => d.clientId) } }, { clientName: 1 }).lean(),
    Invoice.find({ _id: { $in: docs.map((d) => d.invoiceId).filter(Boolean) } }, { number: 1 }).lean(),
  ]);
  const cn = new Map(clients.map((c) => [String(c._id), c.clientName]));
  const inv = new Map(invoices.map((i) => [String(i._id), i.number]));
  return docs.map((p) => ({
    id: String(p._id), clientName: cn.get(String(p.clientId)) ?? "Deleted client",
    invoiceNumber: p.invoiceId ? inv.get(String(p.invoiceId)) ?? null : null,
    amount: p.amount, currency: p.currency as Currency, paymentDate: p.paymentDate.toISOString(),
  }));
}

export type PnlRow = { label: string; revenue: number; expenses: number; profit: number; kind: "month" | "quarter" | "year" };

/** Profit & loss for a calendar year: 12 months, 4 quarter subtotals and the year total. */
export async function getYearPnl(year: number): Promise<{ base: Currency; rows: PnlRow[]; years: number[] }> {
  await connectDB();
  const { base } = await getFx();
  const from = new Date(`${year}-01-01T00:00:00+05:30`);
  const to = new Date(`${year + 1}-01-01T00:00:00+05:30`);
  const [rev, exp, firstPay, firstExp] = await Promise.all([
    sumByMonth("payments", { status: "completed", paymentDate: { $gte: from, $lt: to } }, base),
    sumByMonth("expenses", { deletedAt: null, expenseDate: { $gte: from, $lt: to } }, base),
    Payment.findOne({ status: "completed" }, { paymentDate: 1 }).sort({ paymentDate: 1 }).lean(),
    Expense.findOne({ deletedAt: null }, { expenseDate: 1 }).sort({ expenseDate: 1 }).lean(),
  ]);
  const rows: PnlRow[] = [];
  const yearTotal = { revenue: 0, expenses: 0 };
  for (let q = 0; q < 4; q++) {
    const qt = { revenue: 0, expenses: 0 };
    for (let m = q * 3; m < q * 3 + 3; m++) {
      const revenue = rev.get(ym(year, m)) ?? 0;
      const expenses = exp.get(ym(year, m)) ?? 0;
      qt.revenue += revenue;
      qt.expenses += expenses;
      rows.push({ label: `${MONTHS[m]} ${year}`, revenue, expenses, profit: revenue - expenses, kind: "month" });
    }
    yearTotal.revenue += qt.revenue;
    yearTotal.expenses += qt.expenses;
    rows.push({ label: `Q${q + 1} ${year}`, ...qt, profit: qt.revenue - qt.expenses, kind: "quarter" });
  }
  rows.push({ label: `Total ${year}`, ...yearTotal, profit: yearTotal.revenue - yearTotal.expenses, kind: "year" });

  const current = agencyYearMonth().year;
  const earliest = Math.min(
    firstPay ? firstPay.paymentDate.getUTCFullYear() : current,
    firstExp ? firstExp.expenseDate.getUTCFullYear() : current,
  );
  const years = Array.from({ length: current - earliest + 1 }, (_, i) => current - i);
  return { base, rows, years };
}

/** Per-client money summary in the reporting currency. */
export async function getClientFinanceSummary(clientId: string) {
  await connectDB();
  const { base } = await getFx();
  const id = new Types.ObjectId(clientId);
  const [billed, received, spent, receivables] = await Promise.all([
    Invoice.aggregate<{ total: number }>([
      { $match: { clientId: id, deletedAt: null, status: { $nin: ["draft", "void"] } } },
      { $group: { _id: null, total: { $sum: toBaseExpr(base, "$total") } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $match: { clientId: id, status: "completed" } },
      { $group: { _id: null, total: { $sum: toBaseExpr(base) } } },
    ]),
    Expense.aggregate<{ total: number }>([
      { $match: { clientId: id, deletedAt: null } },
      { $group: { _id: null, total: { $sum: toBaseExpr(base) } } },
    ]),
    getReceivablesSummary(clientId),
  ]);
  return {
    base,
    billed: billed[0]?.total ?? 0,
    received: received[0]?.total ?? 0,
    expenses: spent[0]?.total ?? 0,
    outstanding: receivables.outstanding,
    overdue: receivables.overdue,
  };
}

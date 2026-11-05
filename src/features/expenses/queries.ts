import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Expense, type ExpenseDoc } from "@/server/db/models/expense";
import { ExpenseCategory } from "@/server/db/models/expense-category";
import { Client } from "@/server/db/models/client";
import { authorize } from "@/server/auth/dal";
import { getFx, toBaseExpr } from "@/server/services/fx";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { PAYMENT_METHODS, type Currency, type PaymentMethod } from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { toDayString } from "@/lib/format";
import { isPeriod, periodMatch } from "@/lib/periods";

export type ExpenseRow = {
  id: string;
  name: string;
  categoryName: string;
  amount: number;
  currency: Currency;
  expenseDate: string;
  method: PaymentMethod;
  clientName: string | null;
  receiptRef: string;
  description: string;
  form: {
    id: string; name: string; categoryId: string; amount: string; currency: Currency; expenseDate: string;
    method: PaymentMethod; clientId: string; description: string; receiptRef: string;
  };
};

export const EXPENSE_SORTABLE = ["expenseDate", "amount", "name", "createdAt"] as const;

export function buildExpenseFilter(sp: SearchParams, fixedClientId?: string): QueryFilter<ExpenseDoc> {
  const filter: QueryFilter<ExpenseDoc> = { deletedAt: null };
  const category = first(sp.category);
  if (category && Types.ObjectId.isValid(category)) filter.categoryId = new Types.ObjectId(category);
  const client = fixedClientId ?? first(sp.client);
  if (client && Types.ObjectId.isValid(client)) filter.clientId = new Types.ObjectId(client);
  const method = first(sp.method);
  if (method && (PAYMENT_METHODS as readonly string[]).includes(method)) filter.method = method as PaymentMethod;
  const period = first(sp.period);
  if (isPeriod(period)) {
    const range = periodMatch(period);
    if (range) filter.expenseDate = range;
  }
  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { description: rx }, { receiptRef: rx }];
  }
  return filter;
}

export async function listExpenses(sp: SearchParams, fixedClientId?: string): Promise<Paginated<ExpenseRow> & { totalBase: number; base: Currency }> {
  await authorize("expenses.view");
  await connectDB();
  const params = parseListParams(sp, EXPENSE_SORTABLE, "expenseDate");
  const filter = buildExpenseFilter(sp, fixedClientId);
  const { base } = await getFx();

  const [docs, total, sum] = await Promise.all([
    Expense.find(filter).sort({ [params.sort]: params.dir === "asc" ? 1 : -1, _id: -1 })
      .skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate<{ total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: toBaseExpr(base) } } }]),
  ]);
  const [cats, clients] = await Promise.all([
    ExpenseCategory.find({ _id: { $in: docs.map((d) => d.categoryId) } }, { name: 1 }).lean(),
    Client.find({ _id: { $in: docs.map((d) => d.clientId).filter(Boolean) } }, { clientName: 1 }).lean(),
  ]);
  const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
  const cliMap = new Map(clients.map((c) => [String(c._id), c.clientName]));

  return {
    base,
    totalBase: sum[0]?.total ?? 0,
    rows: docs.map((e) => ({
      id: String(e._id),
      name: e.name,
      categoryName: catMap.get(String(e.categoryId)) ?? "—",
      amount: e.amount,
      currency: e.currency as Currency,
      expenseDate: e.expenseDate.toISOString(),
      method: e.method as PaymentMethod,
      clientName: e.clientId ? cliMap.get(String(e.clientId)) ?? null : null,
      receiptRef: e.receiptRef ?? "",
      description: e.description ?? "",
      form: {
        id: String(e._id), name: e.name, categoryId: String(e.categoryId), amount: minorToAmount(e.amount),
        currency: e.currency as Currency, expenseDate: toDayString(e.expenseDate), method: e.method as PaymentMethod,
        clientId: e.clientId ? String(e.clientId) : "", description: e.description ?? "", receiptRef: e.receiptRef ?? "",
      },
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export type CategoryRow = { id: string; name: string; isActive: boolean; count: number };

export async function listCategories(): Promise<CategoryRow[]> {
  await connectDB();
  const [cats, counts] = await Promise.all([
    ExpenseCategory.find().sort({ isActive: -1, name: 1 }).lean(),
    Expense.aggregate<{ _id: unknown; n: number }>([{ $match: { deletedAt: null } }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]),
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  return cats.map((c) => ({ id: String(c._id), name: c.name, isActive: c.isActive ?? true, count: map.get(String(c._id)) ?? 0 }));
}

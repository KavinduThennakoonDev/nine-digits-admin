import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Payment, type PaymentDoc } from "@/server/db/models/payment";
import { Invoice } from "@/server/db/models/invoice";
import { Client } from "@/server/db/models/client";
import { authorize } from "@/server/auth/dal";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { PAYMENT_METHODS, PAYMENT_STATUSES, type Currency, type PaymentMethod, type PaymentStatus } from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { toDayString } from "@/lib/format";
import { isPeriod, periodMatch } from "@/lib/periods";

export type PaymentRow = {
  id: string;
  clientId: string;
  clientName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: Currency;
  paymentDate: string;
  method: PaymentMethod;
  reference: string;
  description: string;
  status: PaymentStatus;
  refundReason: string;
  /** Values for the edit form. */
  form: {
    id: string; clientId: string; invoiceId: string; amount: string; currency: Currency; paymentDate: string;
    method: PaymentMethod; reference: string; description: string; status: "completed" | "pending" | "failed";
  };
};

export const PAYMENT_SORTABLE = ["paymentDate", "amount", "createdAt"] as const;

export async function listPayments(sp: SearchParams, fixedClientId?: string): Promise<Paginated<PaymentRow>> {
  await authorize("payments.view");
  await connectDB();
  const params = parseListParams(sp, PAYMENT_SORTABLE, "paymentDate");
  const filter: QueryFilter<PaymentDoc> = {};
  const status = first(sp.status);
  if (status && (PAYMENT_STATUSES as readonly string[]).includes(status)) filter.status = status as PaymentStatus;
  const method = first(sp.method);
  if (method && (PAYMENT_METHODS as readonly string[]).includes(method)) filter.method = method as PaymentMethod;
  const period = first(sp.period);
  if (isPeriod(period)) {
    const range = periodMatch(period);
    if (range) filter.paymentDate = range;
  }
  const client = fixedClientId ?? first(sp.client);
  if (client && Types.ObjectId.isValid(client)) filter.clientId = new Types.ObjectId(client);
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    const [clients, invoices] = await Promise.all([
      Client.find({ clientName: rx }, { _id: 1 }).limit(200).lean(),
      Invoice.find({ number: rx }, { _id: 1 }).limit(200).lean(),
    ]);
    filter.$or = [{ reference: rx }, { description: rx }, { clientId: { $in: clients.map((c) => c._id) } }, { invoiceId: { $in: invoices.map((i) => i._id) } }];
  }

  const [docs, total] = await Promise.all([
    Payment.find(filter).sort({ [params.sort]: params.dir === "asc" ? 1 : -1, _id: -1 })
      .skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Payment.countDocuments(filter),
  ]);
  const [clients, invoices] = await Promise.all([
    Client.find({ _id: { $in: docs.map((d) => d.clientId) } }, { clientName: 1 }).lean(),
    Invoice.find({ _id: { $in: docs.map((d) => d.invoiceId).filter(Boolean) } }, { number: 1 }).lean(),
  ]);
  const cMap = new Map(clients.map((c) => [String(c._id), c.clientName]));
  const iMap = new Map(invoices.map((i) => [String(i._id), i.number]));

  return {
    rows: docs.map((p) => ({
      id: String(p._id),
      clientId: String(p.clientId),
      clientName: cMap.get(String(p.clientId)) ?? "Deleted client",
      invoiceId: p.invoiceId ? String(p.invoiceId) : null,
      invoiceNumber: p.invoiceId ? iMap.get(String(p.invoiceId)) ?? null : null,
      amount: p.amount,
      currency: p.currency as Currency,
      paymentDate: p.paymentDate.toISOString(),
      method: p.method as PaymentMethod,
      reference: p.reference ?? "",
      description: p.description ?? "",
      status: p.status as PaymentStatus,
      refundReason: p.refundReason ?? "",
      form: {
        id: String(p._id), clientId: String(p.clientId), invoiceId: p.invoiceId ? String(p.invoiceId) : "",
        amount: minorToAmount(p.amount), currency: p.currency as Currency, paymentDate: toDayString(p.paymentDate),
        method: p.method as PaymentMethod, reference: p.reference ?? "", description: p.description ?? "",
        status: (p.status === "refunded" ? "completed" : p.status) as "completed" | "pending" | "failed",
      },
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

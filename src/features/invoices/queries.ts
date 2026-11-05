import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Invoice, type InvoiceDoc } from "@/server/db/models/invoice";
import { Payment } from "@/server/db/models/payment";
import { Client } from "@/server/db/models/client";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { authorize } from "@/server/auth/dal";
import { getFx, toBaseExpr } from "@/server/services/fx";
import { getSettings } from "@/features/settings/queries";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import {
  INVOICE_STATUSES, OPEN_INVOICE_STATUSES, type Currency, type InvoiceStatus, type PaymentMethod, type PaymentStatus,
} from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { startOfAgencyDay, toDayString } from "@/lib/format";
import type { ComboOption } from "@/components/forms/combobox";

export type DisplayInvoiceStatus = InvoiceStatus | "overdue";

/** Open invoices past their due date (from the start of today, agency time) are overdue. */
export function displayStatus(status: string, dueDate: Date): DisplayInvoiceStatus {
  if ((OPEN_INVOICE_STATUSES as string[]).includes(status) && dueDate < startOfAgencyDay()) return "overdue";
  return status as InvoiceStatus;
}

export type InvoiceRow = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  total: number;
  amountPaid: number;
  balance: number;
  status: DisplayInvoiceStatus;
};

export const INVOICE_SORTABLE = ["number", "issueDate", "dueDate", "total", "createdAt"] as const;

export function buildInvoiceFilter(sp: SearchParams): QueryFilter<InvoiceDoc> {
  const filter: QueryFilter<InvoiceDoc> = { deletedAt: null };
  const status = first(sp.status);
  const today = startOfAgencyDay();
  if (status === "overdue") Object.assign(filter, { status: { $in: OPEN_INVOICE_STATUSES }, dueDate: { $lt: today } });
  else if (status === "open") filter.status = { $in: OPEN_INVOICE_STATUSES } as never;
  else if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) filter.status = status as InvoiceStatus;
  const client = first(sp.client);
  if (client && Types.ObjectId.isValid(client)) filter.clientId = new Types.ObjectId(client);
  const currency = first(sp.currency);
  if (currency === "LKR" || currency === "USD") filter.currency = currency;
  return filter;
}

async function clientNames(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, string>();
  const clients = await Client.find({ _id: { $in: unique } }, { clientName: 1 }).lean();
  return new Map(clients.map((c) => [String(c._id), c.clientName]));
}

export async function listInvoices(sp: SearchParams): Promise<Paginated<InvoiceRow>> {
  await authorize("invoices.view");
  await connectDB();
  const params = parseListParams(sp, INVOICE_SORTABLE, "issueDate");
  const filter = buildInvoiceFilter(sp);
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    const clients = await Client.find({ clientName: rx, deletedAt: null }, { _id: 1 }).limit(200).lean();
    filter.$or = [{ number: rx }, { clientId: { $in: clients.map((c) => c._id) } }];
  }
  const [docs, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ [params.sort]: params.dir === "asc" ? 1 : -1, number: -1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  const names = await clientNames(docs.map((d) => d.clientId));
  return {
    rows: docs.map((i) => ({
      id: String(i._id),
      number: i.number,
      clientId: String(i.clientId),
      clientName: names.get(String(i.clientId)) ?? "Deleted client",
      issueDate: i.issueDate.toISOString(),
      dueDate: i.dueDate.toISOString(),
      currency: i.currency as Currency,
      total: i.total,
      amountPaid: i.amountPaid,
      balance: i.status === "void" ? 0 : i.total - i.amountPaid,
      status: displayStatus(i.status as string, i.dueDate),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Outstanding and overdue totals in the reporting currency. */
export async function getReceivablesSummary(clientId?: string) {
  await connectDB();
  const { base } = await getFx();
  const today = startOfAgencyDay();
  const match: Record<string, unknown> = { deletedAt: null, status: { $in: OPEN_INVOICE_STATUSES } };
  if (clientId) match.clientId = new Types.ObjectId(clientId);
  const [row] = await Invoice.aggregate<{ outstanding: number; overdue: number; openCount: number; overdueCount: number }>([
    { $match: match },
    { $addFields: { balanceBase: toBaseExpr(base, { $subtract: ["$total", "$amountPaid"] }), isOverdue: { $lt: ["$dueDate", today] } } },
    {
      $group: {
        _id: null,
        outstanding: { $sum: "$balanceBase" },
        overdue: { $sum: { $cond: ["$isOverdue", "$balanceBase", 0] } },
        openCount: { $sum: 1 },
        overdueCount: { $sum: { $cond: ["$isOverdue", 1, 0] } },
      },
    },
  ]);
  return { base, outstanding: row?.outstanding ?? 0, overdue: row?.overdue ?? 0, openCount: row?.openCount ?? 0, overdueCount: row?.overdueCount ?? 0 };
}

export type InvoicePaymentRow = {
  id: string; amount: number; currency: Currency; paymentDate: string; method: PaymentMethod; reference: string;
  status: PaymentStatus; refundReason: string;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  status: InvoiceStatus;
  displayStatus: DisplayInvoiceStatus;
  client: { id: string; clientName: string; companyName: string; contactPerson: string; email: string; phone: string; address: string; country: string };
  issueDate: string;
  dueDate: string;
  currency: Currency;
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string;
  terms: string;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string;
  createdByName: string | null;
  payments: InvoicePaymentRow[];
  hasPayments: boolean;
  agency: Awaited<ReturnType<typeof getSettings>>["agency"];
};

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const i = await Invoice.findOne({ _id: id, deletedAt: null }).lean();
  if (!i) return null;
  const [client, payments, creator, settings] = await Promise.all([
    Client.findById(i.clientId).lean(),
    Payment.find({ invoiceId: i._id }).sort({ paymentDate: -1 }).lean(),
    i.createdBy ? User.findById(i.createdBy, { name: 1 }).lean() : null,
    getSettings(),
  ]);
  return {
    id: String(i._id),
    number: i.number,
    status: i.status as InvoiceStatus,
    displayStatus: displayStatus(i.status as string, i.dueDate),
    client: {
      id: String(i.clientId), clientName: client?.clientName ?? "Deleted client", companyName: client?.companyName ?? "",
      contactPerson: client?.contactPerson ?? "", email: client?.email ?? "", phone: client?.phone ?? "", address: client?.address ?? "",
      country: client?.country ?? "",
    },
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    currency: i.currency as Currency,
    lineItems: i.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount })),
    subtotal: i.subtotal,
    discount: i.discount ?? 0,
    taxRate: i.taxRate ?? 0,
    taxAmount: i.taxAmount ?? 0,
    total: i.total,
    amountPaid: i.amountPaid,
    balance: i.status === "void" ? 0 : i.total - i.amountPaid,
    notes: i.notes ?? "",
    terms: i.terms ?? "",
    sentAt: i.sentAt?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    voidedAt: i.voidedAt?.toISOString() ?? null,
    voidReason: i.voidReason ?? "",
    createdByName: creator?.name ?? null,
    payments: payments.map((p) => ({
      id: String(p._id), amount: p.amount, currency: p.currency as Currency, paymentDate: p.paymentDate.toISOString(),
      method: p.method as PaymentMethod, reference: p.reference ?? "", status: p.status as PaymentStatus, refundReason: p.refundReason ?? "",
    })),
    hasPayments: payments.some((p) => p.status === "completed" || p.status === "pending"),
    agency: settings.agency,
  };
}

/** Values for the invoice editor. */
export async function getInvoiceForm(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const i = await Invoice.findOne({ _id: id, deletedAt: null }).lean();
  if (!i) return null;
  const hasPayments = i.amountPaid > 0 || !!(await Payment.exists({ invoiceId: i._id, status: { $in: ["completed", "pending"] } }));
  return {
    number: i.number,
    status: i.status as InvoiceStatus,
    hasPayments,
    values: {
      id: String(i._id),
      clientId: String(i.clientId),
      currency: i.currency as Currency,
      issueDate: toDayString(i.issueDate),
      dueDate: toDayString(i.dueDate),
      lineItems: i.lineItems.map((l) => ({
        serviceId: l.serviceId ? String(l.serviceId) : "", description: l.description,
        quantity: String(l.quantity), unitPrice: minorToAmount(l.unitPrice),
      })),
      discount: i.discount ? minorToAmount(i.discount) : "",
      taxRate: i.taxRate ? String(i.taxRate) : "",
      notes: i.notes ?? "",
      terms: i.terms ?? "",
      send: false,
    },
  };
}

/** Every client (archived ones flagged) for finance pickers. Finance access is organisation-wide. */
export async function getClientOptionsForFinance(): Promise<(ComboOption & { currency: Currency })[]> {
  await connectDB();
  const clients = await Client.find({ deletedAt: null }, { clientName: 1, companyName: 1, archivedAt: 1, monthlyRetainer: 1 })
    .sort({ clientName: 1 }).lean();
  return clients.map((c) => ({
    value: String(c._id),
    label: c.archivedAt ? `${c.clientName} (archived)` : c.clientName,
    hint: c.companyName || undefined,
    currency: (c.monthlyRetainer?.currency ?? "LKR") as Currency,
  }));
}

/** Services with prices, for filling invoice lines. */
export async function getPricedServices() {
  await connectDB();
  const services = await Service.find({ isActive: true }, { name: 1, description: 1, basePrice: 1 }).sort({ name: 1 }).lean();
  return services.map((s) => ({
    value: String(s._id), label: s.name, description: s.description ?? "",
    price: s.basePrice?.amount ?? 0, currency: (s.basePrice?.currency ?? "LKR") as Currency,
  }));
}

/** Open invoices (with balances) a payment can be applied to. */
export async function getOpenInvoices(clientId?: string, includeIds: string[] = []) {
  await connectDB();
  const open = { status: { $in: ["draft", ...OPEN_INVOICE_STATUSES] } };
  const ids = includeIds.filter((id) => Types.ObjectId.isValid(id));
  const filter: Record<string, unknown> = { deletedAt: null, ...(ids.length ? { $or: [open, { _id: { $in: ids } }] } : open) };
  if (clientId) filter.clientId = clientId;
  const docs = await Invoice.find(filter, { number: 1, clientId: 1, currency: 1, total: 1, amountPaid: 1, dueDate: 1 })
    .sort({ dueDate: 1 }).limit(500).lean();
  return docs.map((i) => ({
    id: String(i._id), number: i.number, clientId: String(i.clientId), currency: i.currency as Currency,
    balance: i.total - i.amountPaid, dueDate: i.dueDate.toISOString(),
  }));
}


"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { withTransaction } from "@/server/db/transaction";
import { Invoice } from "@/server/db/models/invoice";
import { Payment } from "@/server/db/models/payment";
import { Client } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { authorize } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { getFx } from "@/server/services/fx";
import { nextInvoiceNumber } from "@/server/services/invoicing";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull } from "@/lib/fields";
import { computeTotals, lineAmount } from "@/lib/invoice-math";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/action-result";
import { invoiceSchema, voidInvoiceSchema, type InvoiceInput, type VoidInvoiceInput } from "./schemas";

function priceInvoice(data: ReturnType<typeof invoiceSchema.parse>) {
  const lineItems = data.lineItems.map((l) => {
    const line = { quantity: Number(l.quantity), unitPrice: amountToMinor(l.unitPrice) ?? 0 };
    return { serviceId: idOrNull(l.serviceId), description: l.description, ...line, amount: lineAmount(line) };
  });
  const taxRate = data.taxRate ? Number(data.taxRate) : 0;
  const totals = computeTotals(lineItems, amountToMinor(data.discount) ?? 0, taxRate);
  if (totals.total <= 0) throw new AppError("VALIDATION", "The invoice total must be more than zero.", { lineItems: ["Add an amount."] });
  return { lineItems, taxRate, ...totals };
}

async function loadInvoice(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND", "Invoice not found.");
  const invoice = await Invoice.findOne({ _id: id, deletedAt: null });
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");
  return invoice;
}

export async function saveInvoiceAction(input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("invoices.manage");
    const data = parse(invoiceSchema, input);
    await connectDB();
    const client = await Client.findOne({ _id: data.clientId, deletedAt: null }, { clientName: 1 }).lean();
    if (!client) throw new AppError("VALIDATION", "That client no longer exists.", { clientId: ["Select a client."] });
    const priced = priceInvoice(data);
    const issueDate = dayToDate(data.issueDate)!;
    const dueDate = dayToDate(data.dueDate)!;

    if (!data.id) {
      const { usdToLkr } = await getFx();
      const id = await withTransaction(async (session) => {
        const number = await nextInvoiceNumber(issueDate, session);
        const [invoice] = await Invoice.create([{
          number, clientId: data.clientId, issueDate, dueDate, currency: data.currency, usdToLkr, ...priced,
          status: data.send ? "sent" : "draft", sentAt: data.send ? new Date() : null,
          notes: data.notes, terms: data.terms, createdBy: actor.id, updatedBy: actor.id,
        }], { session });
        await ClientActivity.create([{
          clientId: data.clientId, type: "system", userId: actor.id, body: "",
          meta: { detail: `Invoice ${number} ${data.send ? "issued" : "drafted"} · ${formatMoney(priced.total, data.currency)}` },
        }], { session });
        return String(invoice._id);
      });
      const created = await Invoice.findById(id, { number: 1 }).lean();
      await audit({ userId: actor.id, action: "create", module: "invoices", recordId: id, summary: `Created invoice ${created?.number} for ${client.clientName}`, after: { total: priced.total, currency: data.currency } });
      refresh();
      return { id };
    }

    const invoice = await loadInvoice(data.id);
    if (invoice.status === "void") throw new AppError("VALIDATION", "Void invoices can't be edited.");
    const hasPayments = invoice.amountPaid > 0 || (await Payment.exists({ invoiceId: invoice._id, status: { $in: ["completed", "pending"] } }));

    if (hasPayments) {
      // Amounts are locked once money has been received against the invoice.
      const changed =
        String(invoice.clientId) !== data.clientId || invoice.currency !== data.currency || invoice.total !== priced.total ||
        JSON.stringify(invoice.lineItems.map((l) => [l.description, l.quantity, l.unitPrice])) !==
          JSON.stringify(priced.lineItems.map((l) => [l.description, l.quantity, l.unitPrice]));
      if (changed) throw new AppError("VALIDATION", "This invoice has payments, so only the due date, notes and terms can change.");
      invoice.set({ dueDate, notes: data.notes, terms: data.terms, updatedBy: actor.id });
    } else {
      invoice.set({
        clientId: data.clientId, issueDate, dueDate, currency: data.currency, ...priced, notes: data.notes, terms: data.terms,
        updatedBy: actor.id,
      });
      if (data.send && invoice.status === "draft") invoice.set({ status: "sent", sentAt: new Date() });
    }
    await invoice.save();
    await audit({ userId: actor.id, action: "update", module: "invoices", recordId: data.id, summary: `Updated invoice ${invoice.number}`, after: { total: invoice.total, dueDate: data.dueDate } });
    refresh();
    return { id: data.id };
  });
}

export async function markInvoiceSentAction(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("invoices.manage");
    await connectDB();
    const invoice = await loadInvoice(id);
    if (invoice.status !== "draft") return null;
    invoice.set({ status: "sent", sentAt: new Date(), updatedBy: actor.id });
    await invoice.save();
    await ClientActivity.create({ clientId: invoice.clientId, type: "system", userId: actor.id, body: "", meta: { detail: `Invoice ${invoice.number} issued · ${formatMoney(invoice.total, invoice.currency)}` } });
    await audit({ userId: actor.id, action: "send", module: "invoices", recordId: id, summary: `Issued invoice ${invoice.number}` });
    refresh();
    return null;
  });
}

export async function voidInvoiceAction(input: VoidInvoiceInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("invoices.manage");
    const data = parse(voidInvoiceSchema, input);
    await connectDB();
    const invoice = await loadInvoice(data.id);
    if (invoice.status === "void") return null;
    if (await Payment.exists({ invoiceId: invoice._id, status: { $in: ["completed", "pending"] } })) {
      throw new AppError("VALIDATION", "Refund or cancel the payments on this invoice before voiding it.");
    }
    invoice.set({ status: "void", voidedAt: new Date(), voidReason: data.reason, updatedBy: actor.id });
    await invoice.save();
    await ClientActivity.create({ clientId: invoice.clientId, type: "system", userId: actor.id, body: data.reason, meta: { detail: `Invoice ${invoice.number} voided` } });
    await audit({ userId: actor.id, action: "void", module: "invoices", recordId: data.id, summary: `Voided invoice ${invoice.number}`, after: { reason: data.reason } });
    refresh();
    return null;
  });
}

/** Only drafts can be deleted; issued invoices must be voided to keep the audit trail. */
export async function deleteDraftInvoiceAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("invoices.manage");
    await connectDB();
    const invoice = await loadInvoice(id);
    if (invoice.status !== "draft") throw new AppError("VALIDATION", "Only drafts can be deleted. Void issued invoices instead.");
    invoice.set({ deletedAt: new Date(), updatedBy: actor.id });
    await invoice.save();
    await audit({ userId: actor.id, action: "delete", module: "invoices", recordId: id, summary: `Deleted draft invoice ${invoice.number}` });
    return null;
  });
  if (!result.ok) return result;
  redirect("/finance/invoices");
}

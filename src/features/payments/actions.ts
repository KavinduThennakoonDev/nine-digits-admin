"use server";

import { refresh } from "next/cache";
import { Types, type ClientSession } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { withTransaction } from "@/server/db/transaction";
import { Payment } from "@/server/db/models/payment";
import { Invoice } from "@/server/db/models/invoice";
import { Client } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { authorize } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { notify, usersWith } from "@/server/services/notify";
import { getFx } from "@/server/services/fx";
import { recomputeInvoice } from "@/server/services/invoicing";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull } from "@/lib/fields";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/action-result";
import { paymentSchema, refundSchema, type PaymentInput, type RefundInput } from "./schemas";

/** Ensures a payment fits its invoice: same client and currency, not void, no overpayment. */
async function checkInvoice(
  data: { invoiceId: string; clientId: string; currency: string; status: string },
  amount: number,
  excludePaymentId: string | null,
  session: ClientSession,
) {
  if (!data.invoiceId) return null;
  const invoice = await Invoice.findOne({ _id: data.invoiceId, deletedAt: null }).session(session);
  if (!invoice) throw new AppError("VALIDATION", "That invoice no longer exists.", { invoiceId: ["Pick another invoice."] });
  if (String(invoice.clientId) !== data.clientId) throw new AppError("VALIDATION", "That invoice belongs to a different client.", { invoiceId: ["Pick one of this client's invoices."] });
  if (invoice.status === "void") throw new AppError("VALIDATION", "That invoice has been voided.", { invoiceId: ["Pick another invoice."] });
  if (invoice.currency !== data.currency) {
    throw new AppError("VALIDATION", `Invoice ${invoice.number} is in ${invoice.currency}. Record the payment in ${invoice.currency}.`, { currency: [`Use ${invoice.currency}.`] });
  }
  if (data.status === "completed") {
    const [agg] = await Payment.aggregate<{ paid: number }>([
      { $match: { invoiceId: invoice._id, status: "completed", ...(excludePaymentId ? { _id: { $ne: new Types.ObjectId(excludePaymentId) } } : {}) } },
      { $group: { _id: null, paid: { $sum: "$amount" } } },
    ]).session(session);
    const balance = invoice.total - (agg?.paid ?? 0);
    if (amount > balance) {
      throw new AppError("VALIDATION", `That's more than the ${formatMoney(balance, invoice.currency)} still owed on ${invoice.number}.`, { amount: [`At most ${formatMoney(balance, invoice.currency)}.`] });
    }
  }
  return invoice;
}

export async function savePaymentAction(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("payments.manage");
    const data = parse(paymentSchema, input);
    await connectDB();
    const client = await Client.findOne({ _id: data.clientId, deletedAt: null }, { clientName: 1 }).lean();
    if (!client) throw new AppError("VALIDATION", "That client no longer exists.", { clientId: ["Select a client."] });
    const amount = amountToMinor(data.amount)!;
    const fields = {
      clientId: data.clientId, invoiceId: idOrNull(data.invoiceId), amount, currency: data.currency,
      paymentDate: dayToDate(data.paymentDate)!, method: data.method, reference: data.reference,
      description: data.description, status: data.status, updatedBy: actor.id,
    };

    if (!data.id) {
      const { usdToLkr } = await getFx();
      const id = await withTransaction(async (session) => {
        const invoice = await checkInvoice(data, amount, null, session);
        const [payment] = await Payment.create([{ ...fields, usdToLkr, createdBy: actor.id }], { session });
        if (invoice) await recomputeInvoice(invoice._id, session);
        if (data.status === "completed") {
          await ClientActivity.create([{
            clientId: data.clientId, type: "system", userId: actor.id, body: data.description,
            meta: { detail: `Payment received · ${formatMoney(amount, data.currency)}${invoice ? ` for ${invoice.number}` : ""}` },
          }], { session });
        }
        return String(payment._id);
      });
      await audit({ userId: actor.id, action: "create", module: "payments", recordId: id, summary: `Recorded payment ${formatMoney(amount, data.currency)} from ${client.clientName}`, after: { amount, currency: data.currency, status: data.status } });
      if (data.status === "completed") {
        await notify({
          type: "payment_received", actorId: actor.id, userIds: await usersWith("payments.view"),
          title: `Payment received: ${formatMoney(amount, data.currency)}`, body: client.clientName,
          link: data.invoiceId ? `/finance/invoices/${data.invoiceId}` : "/finance/payments",
        });
      }
      refresh();
      return { id };
    }

    if (!Types.ObjectId.isValid(data.id)) throw new AppError("NOT_FOUND", "Payment not found.");
    await withTransaction(async (session) => {
      const payment = await Payment.findById(data.id).session(session);
      if (!payment) throw new AppError("NOT_FOUND", "Payment not found.");
      if (payment.status === "refunded") throw new AppError("VALIDATION", "Refunded payments can't be edited.");
      const previousInvoice = payment.invoiceId ? String(payment.invoiceId) : null;
      await checkInvoice(data, amount, data.id!, session);
      payment.set(fields);
      await payment.save({ session });
      for (const invoiceId of new Set([previousInvoice, data.invoiceId || null].filter(Boolean) as string[])) {
        await recomputeInvoice(invoiceId, session);
      }
    });
    await audit({ userId: actor.id, action: "update", module: "payments", recordId: data.id, summary: `Updated payment from ${client.clientName}`, after: { amount, currency: data.currency, status: data.status } });
    refresh();
    return { id: data.id };
  });
}

export async function refundPaymentAction(input: RefundInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("payments.manage");
    const data = parse(refundSchema, input);
    await connectDB();
    const summary = await withTransaction(async (session) => {
      const payment = await Payment.findById(data.id).session(session);
      if (!payment) throw new AppError("NOT_FOUND", "Payment not found.");
      if (payment.status !== "completed") throw new AppError("VALIDATION", "Only completed payments can be refunded.");
      payment.set({ status: "refunded", refundedAt: new Date(), refundReason: data.reason, updatedBy: actor.id });
      await payment.save({ session });
      if (payment.invoiceId) await recomputeInvoice(payment.invoiceId, session);
      const text = `Payment refunded · ${formatMoney(payment.amount, payment.currency)}`;
      await ClientActivity.create([{ clientId: payment.clientId, type: "system", userId: actor.id, body: data.reason, meta: { detail: text } }], { session });
      return text;
    });
    await audit({ userId: actor.id, action: "refund", module: "payments", recordId: data.id, summary, after: { reason: data.reason } });
    refresh();
    return null;
  });
}

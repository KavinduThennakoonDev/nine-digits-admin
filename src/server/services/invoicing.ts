import "server-only";
import type { ClientSession, Types } from "mongoose";
import { Counter } from "../db/models/counter";
import { Invoice } from "../db/models/invoice";
import { Payment } from "../db/models/payment";
import { Settings } from "../db/models/settings";
import { statusAfterPayments } from "@/lib/invoice-math";

/** Next sequential number for the year, e.g. ND-2026-0007. Must run inside the creating transaction. */
export async function nextInvoiceNumber(issueDate: Date, session: ClientSession): Promise<string> {
  const year = issueDate.getUTCFullYear();
  const settings = await Settings.findOne({ key: "global" }, { invoice: 1 }).session(session).lean();
  const prefix = settings?.invoice?.prefix || "ND";
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return `${prefix}-${year}-${String(counter!.seq).padStart(4, "0")}`;
}

/**
 * Re-derives amountPaid and status from the invoice's completed payments.
 * Called after every payment change, inside the same transaction.
 */
export async function recomputeInvoice(invoiceId: Types.ObjectId | string, session: ClientSession) {
  const invoice = await Invoice.findById(invoiceId).session(session);
  if (!invoice) return;
  const [agg] = await Payment.aggregate<{ paid: number; lastPaidAt: Date }>([
    { $match: { invoiceId: invoice._id, status: "completed" } },
    { $group: { _id: null, paid: { $sum: "$amount" }, lastPaidAt: { $max: "$paymentDate" } } },
  ]).session(session);
  const paid = agg?.paid ?? 0;
  invoice.amountPaid = paid;
  invoice.status = statusAfterPayments(invoice.status, invoice.total, paid);
  invoice.paidAt = invoice.status === "paid" ? agg?.lastPaidAt ?? new Date() : null;
  if (invoice.status !== "draft" && !invoice.sentAt) invoice.sentAt = new Date();
  await invoice.save({ session });
  return invoice;
}

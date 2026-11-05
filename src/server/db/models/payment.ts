import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";

/** Money received. Never deleted — refunds and failures change the status instead. */
const paymentSchema = new Schema(
  {
    ...auditFieldDefs,
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    /** Optional: payments can be ad-hoc income without an invoice. */
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    usdToLkr: { type: Number, required: true },
    paymentDate: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    reference: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "completed" },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, default: "" },
  },
  { timestamps: true },
);
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ clientId: 1, paymentDate: -1 });
paymentSchema.index({ invoiceId: 1, status: 1 });
paymentSchema.index({ status: 1, paymentDate: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;
export const Payment = defineModel("Payment", paymentSchema);

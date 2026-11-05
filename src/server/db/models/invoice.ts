import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES, INVOICE_STATUSES } from "@/lib/constants";

const lineItemSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    /** Minor units. */
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** All money fields are integer minor units in `currency`. */
const invoiceSchema = new Schema(
  {
    ...auditFieldDefs,
    number: { type: String, required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** USD→LKR rate snapshotted when the invoice was created/last priced. */
    usdToLkr: { type: Number, required: true },
    lineItems: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    /** Sum of completed payments — maintained by recomputeInvoice(). */
    amountPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "draft" },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
invoiceSchema.index({ clientId: 1, issueDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ deletedAt: 1, issueDate: -1 });

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema>;
export const Invoice = defineModel("Invoice", invoiceSchema);

import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";

const expenseSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    usdToLkr: { type: Number, required: true },
    expenseDate: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    description: { type: String, default: "" },
    /** No file storage: a link to the receipt (Drive, email, etc.) or a reference number. */
    receiptRef: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
expenseSchema.index({ deletedAt: 1, expenseDate: -1 });
expenseSchema.index({ categoryId: 1, expenseDate: -1 });
expenseSchema.index({ clientId: 1, expenseDate: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;
export const Expense = defineModel("Expense", expenseSchema);

import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";

const expenseCategorySchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
expenseCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type ExpenseCategoryDoc = InferSchemaType<typeof expenseCategorySchema>;
export const ExpenseCategory = defineModel("ExpenseCategory", expenseCategorySchema);

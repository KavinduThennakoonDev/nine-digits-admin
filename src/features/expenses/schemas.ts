import { z } from "zod";
import { currency, objectId, optionalId, requiredDay, requiredText, text } from "@/lib/fields";
import { PAYMENT_METHODS } from "@/lib/constants";

export const expenseSchema = z.object({
  id: z.string().optional(),
  name: requiredText("what the expense was for", 160),
  categoryId: objectId.or(z.literal("")).refine((v) => v !== "", "Select a category."),
  amount: z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50.")
    .refine((v) => Number(v) > 0, "Amount must be more than 0."),
  currency,
  expenseDate: requiredDay,
  method: z.enum(PAYMENT_METHODS),
  clientId: optionalId,
  description: text(1000),
  receiptRef: z.union([z.literal(""), z.string().trim().max(500)]).default(""),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const categorySchema = z.object({
  id: z.string().optional(),
  name: requiredText("a category name", 60),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.input<typeof categorySchema>;

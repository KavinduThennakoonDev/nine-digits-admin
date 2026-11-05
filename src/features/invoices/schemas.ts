import { z } from "zod";
import { currency, objectId, optionalAmount, optionalId, requiredDay, requiredText, text } from "@/lib/fields";

const quantity = z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, "Use a number like 1 or 2.5.")
  .refine((v) => Number(v) > 0, "Must be more than 0.");
const price = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a price like 1500 or 1500.50.");

export const lineItemSchema = z.object({
  serviceId: optionalId,
  description: requiredText("a description", 500),
  quantity,
  unitPrice: price,
});
export type LineItemInput = z.input<typeof lineItemSchema>;

export const invoiceSchema = z
  .object({
    id: z.string().optional(),
    clientId: objectId.or(z.literal("")).refine((v) => v !== "", "Select a client."),
    currency,
    issueDate: requiredDay,
    dueDate: requiredDay,
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item.").max(100),
    discount: optionalAmount,
    taxRate: z.union([z.literal(""), z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?$|^100$/, "Enter a percentage from 0 to 100.")]).default(""),
    notes: text(2000),
    terms: text(2000),
    /** Issue immediately instead of saving as a draft. */
    send: z.boolean().default(false),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "Due date can't be before the issue date." });
export type InvoiceInput = z.input<typeof invoiceSchema>;

export const voidInvoiceSchema = z.object({ id: objectId, reason: requiredText("a reason", 500) });
export type VoidInvoiceInput = z.input<typeof voidInvoiceSchema>;

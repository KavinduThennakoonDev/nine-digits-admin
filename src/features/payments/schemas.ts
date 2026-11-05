import { z } from "zod";
import { currency, objectId, optionalId, requiredDay, requiredText, text } from "@/lib/fields";
import { PAYMENT_METHODS } from "@/lib/constants";

export const paymentSchema = z.object({
  id: z.string().optional(),
  clientId: objectId.or(z.literal("")).refine((v) => v !== "", "Select a client."),
  invoiceId: optionalId,
  amount: z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50.")
    .refine((v) => Number(v) > 0, "Amount must be more than 0."),
  currency,
  paymentDate: requiredDay,
  method: z.enum(PAYMENT_METHODS),
  reference: text(120),
  description: text(1000),
  /** "refunded" is only reachable through the refund action. */
  status: z.enum(["completed", "pending", "failed"]),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const refundSchema = z.object({ id: objectId, reason: requiredText("a reason", 500) });
export type RefundInput = z.input<typeof refundSchema>;

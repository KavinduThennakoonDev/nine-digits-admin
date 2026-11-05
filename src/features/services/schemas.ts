import { z } from "zod";
import { currency, optionalAmount, requiredText, text } from "@/lib/fields";
import { SERVICE_BILLING } from "@/lib/constants";

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: requiredText("a service name", 120),
  category: text(80),
  description: text(1000),
  billing: z.enum(SERVICE_BILLING),
  price: optionalAmount,
  currency,
  isActive: z.boolean().default(true),
});
export type ServiceInput = z.input<typeof serviceSchema>;

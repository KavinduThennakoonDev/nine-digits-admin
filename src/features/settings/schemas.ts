import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";

const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email.")]);
const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL (https://…).")]);

export const agencySchema = z.object({
  name: z.string().trim().min(2, "Enter the agency name.").max(120),
  legalName: z.string().trim().max(160).default(""),
  email: optionalEmail.default(""),
  phone: z.string().trim().max(40).default(""),
  website: optionalUrl.default(""),
  address: z.string().trim().max(300).default(""),
  country: z.string().trim().max(80).default(""),
  taxId: z.string().trim().max(60).default(""),
});
export type AgencyInput = z.input<typeof agencySchema>;

export const currencySchema = z.object({
  base: z.enum(CURRENCIES),
  usdToLkr: z.coerce.number<number>().positive("Rate must be greater than 0.").max(100000),
  invoicePrefix: z.string().trim().min(1).max(10).regex(/^[A-Z0-9-]+$/, "Use A–Z, 0–9 or dashes."),
  defaultDueDays: z.coerce.number<number>().int().min(0).max(365),
});
export type CurrencyInput = z.input<typeof currencySchema>;

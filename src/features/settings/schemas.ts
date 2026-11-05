import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";
import { STATUS_TONES } from "@/lib/lead-statuses";

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

export const leadStatusesSchema = z.object({
  statuses: z
    .array(z.object({
      /** Empty for a status added in this edit; the server derives a key from the name. */
      key: z.string().max(40).default(""),
      label: z.string().trim().min(1, "Name the status.").max(40, "Keep it under 40 characters."),
      tone: z.enum(STATUS_TONES),
      closed: z.boolean(),
    }))
    .min(3, "Keep at least three statuses.")
    .max(30, "Up to 30 statuses.")
    .superRefine((list, ctx) => {
      const seen = new Map<string, number>();
      list.forEach((s, i) => {
        const k = s.label.trim().toLowerCase();
        if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "label"], message: "Another status already has this name." });
        else seen.set(k, i);
      });
    }),
  /** Removed status key → status its leads move to. */
  remap: z.record(z.string(), z.string()).default({}),
});
export type LeadStatusesInput = z.input<typeof leadStatusesSchema>;

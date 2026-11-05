import { z } from "zod";
import {
  currency, objectId, optionalAmount, optionalDay, optionalEmail, optionalId, optionalInstant, phone, requiredText, text,
} from "@/lib/fields";
import { CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/constants";

export const clientSchema = z
  .object({
    id: z.string().optional(),
    clientName: requiredText("the client name", 160),
    companyName: text(160),
    contactPerson: text(120),
    email: optionalEmail,
    phone,
    whatsapp: phone,
    address: text(500),
    country: text(80),
    industry: text(80),
    clientType: z.enum(CLIENT_TYPES),
    status: z.enum(CLIENT_STATUSES),
    assignedTo: optionalId,
    serviceIds: z.array(objectId).max(50).default([]),
    contractStart: optionalDay,
    contractEnd: optionalDay,
    retainer: optionalAmount,
    retainerCurrency: currency,
    notes: text(5000),
  })
  .refine((v) => !v.contractStart || !v.contractEnd || v.contractEnd >= v.contractStart, {
    path: ["contractEnd"],
    message: "Contract end must be on or after the start date.",
  });
export type ClientInput = z.input<typeof clientSchema>;

export const CLIENT_LOG_TYPES = ["note", "call", "email", "whatsapp", "meeting"] as const;
export const clientActivitySchema = z.object({
  clientId: objectId,
  type: z.enum(CLIENT_LOG_TYPES),
  body: requiredText("some details", 5000),
  occurredAt: optionalInstant,
});
export type ClientActivityInput = z.input<typeof clientActivitySchema>;

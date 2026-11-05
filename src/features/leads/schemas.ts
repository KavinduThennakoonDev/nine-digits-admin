import { z } from "zod";
import {
  currency, objectId, optionalAmount, optionalDay, optionalEmail, optionalId, optionalInstant, phone, requiredDay, requiredText, text,
} from "@/lib/fields";
import { CALL_OUTCOMES, CLIENT_STATUSES, CLIENT_TYPES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";

/** "converted" is only reachable through the conversion flow, which links the new client. */
export const EDITABLE_LEAD_STATUSES = LEAD_STATUSES.filter((s) => s !== "converted");

export const leadSchema = z
  .object({
    id: z.string().optional(),
    fullName: requiredText("the lead's name", 160),
    email: optionalEmail,
    phone,
    whatsapp: phone,
    country: text(80),
    company: text(160),
    interestedServiceId: optionalId,
    source: z.enum(LEAD_SOURCES),
    status: z.enum(LEAD_STATUSES),
    assignedTo: optionalId,
    leadDate: requiredDay,
    nextFollowUpAt: optionalInstant,
    notes: text(5000),
  })
  .refine((v) => v.email || v.phone || v.whatsapp, {
    path: ["phone"],
    message: "Add at least one way to reach them (phone, WhatsApp or email).",
  });
export type LeadInput = z.input<typeof leadSchema>;

export const LEAD_LOG_TYPES = ["call", "whatsapp", "email", "meeting", "note"] as const;

export const logActivitySchema = z
  .object({
    leadId: objectId,
    type: z.enum(LEAD_LOG_TYPES),
    occurredAt: optionalInstant,
    outcome: z.union([z.literal(""), z.enum(CALL_OUTCOMES)]).default(""),
    durationMin: z.union([z.literal(""), z.string().regex(/^\d{1,4}$/, "Minutes as a whole number.")]).default(""),
    notes: text(5000),
    newStatus: z.union([z.literal(""), z.enum(EDITABLE_LEAD_STATUSES as [string, ...string[]])]).default(""),
    followUp: z.enum(["keep", "set", "clear"]).default("keep"),
    nextFollowUpAt: optionalInstant,
  })
  .refine((v) => v.type !== "call" || v.outcome, { path: ["outcome"], message: "Pick how the call went." })
  .refine((v) => v.type !== "note" || v.notes, { path: ["notes"], message: "Write the note." })
  .refine((v) => v.followUp !== "set" || v.nextFollowUpAt, { path: ["nextFollowUpAt"], message: "Pick the follow-up date and time." });
export type LogActivityInput = z.input<typeof logActivitySchema>;

export const convertLeadSchema = z.object({
  leadId: objectId,
  clientName: requiredText("the client name", 160),
  companyName: text(160),
  clientType: z.enum(CLIENT_TYPES),
  status: z.enum(CLIENT_STATUSES),
  assignedTo: optionalId,
  serviceIds: z.array(objectId).max(50).default([]),
  contractStart: optionalDay,
  retainer: optionalAmount,
  retainerCurrency: currency,
});
export type ConvertLeadInput = z.input<typeof convertLeadSchema>;

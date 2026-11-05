import { z } from "zod";
import { currency, objectId, optionalAmount, optionalDay, optionalId, requiredText, text } from "@/lib/fields";
import { PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

export const projectSchema = z
  .object({
    id: z.string().optional(),
    name: requiredText("a project name", 160),
    clientId: optionalId,
    serviceIds: z.array(objectId).max(50).default([]),
    budget: optionalAmount,
    budgetCurrency: currency,
    startDate: optionalDay,
    deadline: optionalDay,
    managerId: optionalId,
    memberIds: z.array(objectId).max(100).default([]),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PRIORITIES),
    description: text(5000),
  })
  .refine((v) => !v.startDate || !v.deadline || v.deadline >= v.startDate, { path: ["deadline"], message: "Deadline can't be before the start date." });
export type ProjectInput = z.input<typeof projectSchema>;

export const projectNoteSchema = z.object({ projectId: objectId, body: requiredText("a note", 5000) });
export type ProjectNoteInput = z.input<typeof projectNoteSchema>;

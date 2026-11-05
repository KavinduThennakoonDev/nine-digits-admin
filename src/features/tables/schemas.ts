import { z } from "zod";
import { objectId, requiredText, text } from "@/lib/fields";
import { CURRENCIES } from "@/lib/constants";
import { FIELD_TYPES, TABLE_ICONS } from "@/lib/dynamic/types";

const optionalNumber = z.union([z.literal(""), z.string().trim().regex(/^-?\d{1,13}(\.\d{1,6})?$/, "Enter a number.")]).default("");

export const fieldDraftSchema = z
  .object({
    /** Present when editing an existing field. */
    id: z.string().optional(),
    label: requiredText("a field name", 80),
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and _ only, starting with a letter."),
    type: z.enum(FIELD_TYPES),
    placeholder: text(200),
    helpText: text(300),
    required: z.boolean().default(false),
    defaultValue: z.union([z.string().max(2000), z.array(z.string()), z.boolean()]).default(""),
    options: z.array(z.object({ id: z.string().optional(), label: requiredText("an option label", 80) })).max(200).default([]),
    min: optionalNumber,
    max: optionalNumber,
    currency: z.enum(CURRENCIES).default("LKR"),
    showInTable: z.boolean().default(true),
    showInForm: z.boolean().default(true),
  })
  .refine((f) => (f.type !== "select" && f.type !== "multiselect") || f.options.length > 0, { path: ["options"], message: "Add at least one option." })
  .refine((f) => new Set(f.options.map((o) => o.label.toLowerCase())).size === f.options.length, { path: ["options"], message: "Option labels must be unique." })
  .refine((f) => f.min === "" || f.max === "" || Number(f.min) <= Number(f.max), { path: ["max"], message: "Max must be at least the min." });
export type FieldDraft = z.input<typeof fieldDraftSchema>;

export const tableMetaSchema = z.object({
  name: requiredText("a table name", 80),
  description: text(500),
  icon: z.enum(TABLE_ICONS).default("table"),
});
export type TableMetaInput = z.input<typeof tableMetaSchema>;

export const createTableSchema = tableMetaSchema.extend({
  fields: z.array(fieldDraftSchema).min(1, "Add at least one field.").max(100),
});
export type CreateTableInput = z.input<typeof createTableSchema>;

export const accessSchema = z.object({
  tableId: objectId,
  defaultLevel: z.enum(["none", "view", "edit"]),
  roleAccess: z.array(z.object({ roleId: objectId, level: z.enum(["none", "view", "edit"]) })).max(50),
});
export type AccessInput = z.input<typeof accessSchema>;

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { connectDB } from "@/server/db/connect";
import { withTransaction } from "@/server/db/transaction";
import { DynamicTable } from "@/server/db/models/dynamic-table";
import { DynamicRecord } from "@/server/db/models/dynamic-record";
import { Role } from "@/server/db/models/role";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import {
  activeFields, convertField, levelAtLeast, loadTableOrThrow, newId, reindexTable, serializeField,
  serializeTable, tableLevel, type ConversionPreview,
} from "@/server/services/dynamic-tables";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { defaultInput, hasOptions, inputSchema, keyFromLabel, supportsMinMax, toStored } from "@/lib/dynamic/registry";
import { FIELD_TYPE_META, type FieldDef } from "@/lib/dynamic/types";
import type { ActionResult } from "@/lib/action-result";
import {
  accessSchema, createTableSchema, fieldDraftSchema, tableMetaSchema,
  type AccessInput, type CreateTableInput, type FieldDraft, type TableMetaInput,
} from "./schemas";

/* ── helpers ─────────────────────────────────────────────── */

async function slugFor(name: string, excludeId?: string) {
  const raw = keyFromLabel(name).replace(/_/g, "-") || "table";
  // "/tables/new" is the create page, so that slug is reserved.
  const base = raw === "new" ? "new-table" : raw;
  let slug = base;
  for (let i = 2; await DynamicTable.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) slug = `${base}-${i}`;
  return slug;
}

/** Loads a table and checks the actor can manage its structure. */
async function manageable(tableId: string, actor: CurrentUser) {
  const table = await loadTableOrThrow(tableId);
  if (!table) throw new AppError("NOT_FOUND", "Table not found.");
  if (!levelAtLeast(tableLevel(actor, table), "manage")) throw new AppError("FORBIDDEN", "You can't change this table's structure.");
  return table;
}

/** Validated draft → stored field definition (keeps option ids stable). */
function draftToField(draft: ReturnType<typeof fieldDraftSchema.parse>, existing: FieldDef | null, order: number): FieldDef {
  const options = hasOptions(draft.type)
    ? draft.options.map((o) => ({ id: o.id && (existing?.options.some((x) => x.id === o.id) ?? false) ? o.id : newId("opt"), label: o.label }))
    : [];
  const minMax = supportsMinMax(draft.type);
  const field: FieldDef = {
    id: existing?.id ?? newId("fld"),
    key: draft.key,
    label: draft.label,
    type: draft.type,
    placeholder: draft.placeholder,
    helpText: draft.helpText,
    required: draft.required,
    defaultValue: "",
    options,
    min: minMax && draft.min !== "" ? Number(draft.min) : null,
    max: minMax && draft.max !== "" ? Number(draft.max) : null,
    currency: draft.currency,
    order,
    showInTable: draft.showInTable,
    showInForm: draft.showInForm,
    archivedAt: existing?.archivedAt ?? null,
  };
  // Default value: map option labels/ids and validate with the field's own rules.
  let def = draft.defaultValue;
  if (field.type === "select" && typeof def === "string") def = options.find((o) => o.id === def || o.label === def)?.id ?? "";
  if (field.type === "multiselect" && Array.isArray(def)) def = def.map((d) => options.find((o) => o.id === d || o.label === d)?.id).filter(Boolean) as string[];
  const normalised = defaultInput({ type: field.type, defaultValue: def });
  if (!inputSchema({ ...field, required: false }).safeParse(normalised).success) {
    throw new AppError("VALIDATION", "The default value doesn't fit this field.", { defaultValue: ["Doesn't match the field type or rules."] });
  }
  field.defaultValue = normalised;
  return field;
}

function assertUniqueKey(fields: FieldDef[], key: string, exceptId?: string) {
  if (fields.some((f) => f.key === key && f.id !== exceptId)) {
    throw new AppError("CONFLICT", `Another field already uses the key “${key}”.`, { key: ["Must be unique in this table."] });
  }
}

const toPlainFields = (fields: FieldDef[]) => fields.map((f) => ({ ...f, archivedAt: f.archivedAt ? new Date(f.archivedAt) : null }));

/* ── tables ──────────────────────────────────────────────── */

export async function createTableAction(input: CreateTableInput): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const actor = await authorize("tables.manage");
    const data = parse(createTableSchema, input);
    await connectDB();
    const keys = data.fields.map((f) => f.key);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) throw new AppError("VALIDATION", `Two fields use the key “${dup}”. Keys must be unique.`);
    const fields = data.fields.map((f, i) => draftToField(f, null, i));
    const slug = await slugFor(data.name);
    const table = await DynamicTable.create({
      name: data.name, slug, description: data.description, icon: data.icon, fields: toPlainFields(fields),
      createdBy: actor.id, updatedBy: actor.id,
    });
    await audit({ userId: actor.id, action: "create", module: "tables", recordId: String(table._id), summary: `Created table “${data.name}” with ${fields.length} fields` });
    refresh();
    return { slug };
  });
}

export async function updateTableMetaAction(tableId: string, input: TableMetaInput): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    const data = parse(tableMetaSchema, input);
    await connectDB();
    const table = await manageable(tableId, actor);
    const before = table.name;
    table.set({ name: data.name, description: data.description, icon: data.icon, updatedBy: actor.id });
    await table.save();
    if (before !== data.name) await audit({ userId: actor.id, action: "update", module: "tables", recordId: tableId, summary: `Renamed table “${before}” → “${data.name}”` });
    refresh();
    return { slug: table.slug };
  });
}

export async function setTableArchivedAction(tableId: string, archived: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tables.manage");
    await connectDB();
    const table = await manageable(tableId, actor);
    table.set({ archivedAt: archived ? new Date() : null, updatedBy: actor.id });
    await table.save();
    await audit({ userId: actor.id, action: archived ? "archive" : "restore", module: "tables", recordId: tableId, summary: `${archived ? "Archived" : "Restored"} table “${table.name}”` });
    refresh();
    return null;
  });
}

/** Soft delete: the table and its records disappear from the app but stay in the database. */
export async function deleteTableAction(tableId: string, confirmName: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("tables.manage");
    await connectDB();
    const table = await manageable(tableId, actor);
    if (confirmName.trim() !== table.name) throw new AppError("VALIDATION", "Type the table name exactly to confirm.");
    table.set({ deletedAt: new Date(), updatedBy: actor.id });
    await table.save();
    const records = await DynamicRecord.countDocuments({ tableId, deletedAt: null });
    await audit({ userId: actor.id, action: "delete", module: "tables", recordId: tableId, summary: `Deleted table “${table.name}” (${records} records kept in the database)` });
    return null;
  });
  if (!result.ok) return result;
  redirect("/tables");
}

export async function updateAccessAction(input: AccessInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tables.manage");
    const data = parse(accessSchema, input);
    await connectDB();
    const table = await manageable(data.tableId, actor);
    const roleIds = [...new Set(data.roleAccess.map((r) => r.roleId))];
    if ((await Role.countDocuments({ _id: { $in: roleIds } })) !== roleIds.length) throw new AppError("VALIDATION", "One of the roles no longer exists.");
    table.set({ defaultLevel: data.defaultLevel, roleAccess: data.roleAccess, updatedBy: actor.id });
    await table.save();
    await audit({ userId: actor.id, action: "update", module: "tables", recordId: data.tableId, summary: `Updated access for “${table.name}”`, after: { defaultLevel: data.defaultLevel, roleAccess: data.roleAccess } });
    refresh();
    return null;
  });
}

/* ── fields ──────────────────────────────────────────────── */

/** Dry run of a type change: how many values convert, which don't, and options that would be created. */
export async function previewFieldChangeAction(tableId: string, input: FieldDraft): Promise<ActionResult<ConversionPreview>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    const draft = parse(fieldDraftSchema, input);
    await connectDB();
    const table = await manageable(tableId, actor);
    const meta = serializeTable(table.toObject(), actor);
    const existing = meta.fields.find((f) => f.id === draft.id);
    if (!existing) throw new AppError("NOT_FOUND", "Field not found.");
    const next = draftToField({ ...draft, defaultValue: "" }, existing, existing.order);
    const { preview } = await convertField(tableId, existing, next, true);
    return preview;
  });
}

export async function saveFieldAction(
  tableId: string,
  input: FieldDraft,
  opts: { confirmTypeChange?: boolean; backfillDefault?: boolean } = {},
): Promise<ActionResult<{ converted?: ConversionPreview }>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    const draft = parse(fieldDraftSchema, input);
    await connectDB();
    const table = await manageable(tableId, actor);
    const meta = serializeTable(table.toObject(), actor);
    const fields = meta.fields;
    const existing = draft.id ? fields.find((f) => f.id === draft.id) ?? null : null;
    if (draft.id && !existing) throw new AppError("NOT_FOUND", "Field not found.");
    assertUniqueKey(fields, draft.key, existing?.id);

    let field = draftToField(draft, existing, existing?.order ?? Math.max(-1, ...fields.map((f) => f.order)) + 1);
    let converted: ConversionPreview | undefined;
    let nextFields = existing ? fields.map((f) => (f.id === field.id ? field : f)) : [...fields, field];

    if (existing && existing.type !== field.type) {
      if (!opts.confirmTypeChange) throw new AppError("VALIDATION", "Review the conversion preview before changing the field type.");
      // Values and the field definition change together, or not at all.
      await withTransaction(async (session) => {
        const result = await convertField(tableId, existing, field, false, session);
        converted = result.preview;
        field = { ...field, options: result.field.options };
        nextFields = fields.map((f) => (f.id === field.id ? field : f));
        table.set({ fields: toPlainFields(nextFields), schemaVersion: (table.schemaVersion ?? 1) + 1, updatedBy: actor.id });
        await table.save({ session });
      });
    } else {
      table.set({ fields: toPlainFields(nextFields), schemaVersion: (table.schemaVersion ?? 1) + 1, updatedBy: actor.id });
      await table.save();
    }

    // New field with a default: optionally fill it into existing records.
    if (!existing && opts.backfillDefault) {
      const stored = toStored(field, field.defaultValue);
      if (stored !== null) await DynamicRecord.updateMany({ tableId, deletedAt: null, [`data.${field.id}`]: { $exists: false } }, { $set: { [`data.${field.id}`]: stored } });
    }
    await reindexTable(tableId, nextFields);

    await audit({
      userId: actor.id, action: existing ? "update" : "create", module: "tables", recordId: tableId,
      summary: existing
        ? `Updated field “${field.label}” in “${table.name}”${converted ? ` (${FIELD_TYPE_META[existing.type].label} → ${FIELD_TYPE_META[field.type].label}, ${converted.failureCount} value(s) set aside)` : ""}`
        : `Added field “${field.label}” (${FIELD_TYPE_META[field.type].label}) to “${table.name}”`,
    });
    refresh();
    return { converted };
  });
}

/** Archiving hides a field everywhere but keeps every record's value; restoring brings it back. */
export async function setFieldArchivedAction(tableId: string, fieldId: string, archived: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    await connectDB();
    const table = await manageable(tableId, actor);
    const fields = (table.fields as unknown[]).map(serializeField);
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new AppError("NOT_FOUND", "Field not found.");
    if (archived && activeFields(fields).length <= 1) throw new AppError("VALIDATION", "A table needs at least one active field.");
    const next = fields.map((f) => (f.id === fieldId ? { ...f, archivedAt: archived ? new Date().toISOString() : null } : f));
    table.set({ fields: toPlainFields(next), schemaVersion: (table.schemaVersion ?? 1) + 1, updatedBy: actor.id });
    await table.save();
    await reindexTable(tableId, next);
    await audit({ userId: actor.id, action: archived ? "archive" : "restore", module: "tables", recordId: tableId, summary: `${archived ? "Archived" : "Restored"} field “${field.label}” in “${table.name}”` });
    refresh();
    return null;
  });
}

/** Permanently removes an archived field and its values from every record. */
export async function purgeFieldAction(tableId: string, fieldId: string, confirmLabel: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tables.manage");
    await connectDB();
    const table = await manageable(tableId, actor);
    const fields = (table.fields as unknown[]).map(serializeField);
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new AppError("NOT_FOUND", "Field not found.");
    if (!field.archivedAt) throw new AppError("VALIDATION", "Archive the field before deleting it permanently.");
    if (confirmLabel.trim() !== field.label) throw new AppError("VALIDATION", "Type the field name exactly to confirm.");
    const res = await DynamicRecord.updateMany({ tableId }, { $unset: { [`data.${fieldId}`]: "", [`legacy.${fieldId}`]: "" } });
    table.set({ fields: toPlainFields(fields.filter((f) => f.id !== fieldId)), schemaVersion: (table.schemaVersion ?? 1) + 1, updatedBy: actor.id });
    await table.save();
    await audit({ userId: actor.id, action: "purge", module: "tables", recordId: tableId, summary: `Permanently deleted field “${field.label}” from “${table.name}” (${res.modifiedCount} records)` });
    refresh();
    return null;
  });
}

export async function reorderFieldsAction(tableId: string, fieldIds: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    await connectDB();
    const table = await manageable(tableId, actor);
    const fields = (table.fields as unknown[]).map(serializeField);
    if (fieldIds.length !== fields.length || !fields.every((f) => fieldIds.includes(f.id))) throw new AppError("VALIDATION", "The field list changed. Reload and try again.");
    const next = fields.map((f) => ({ ...f, order: fieldIds.indexOf(f.id) }));
    table.set({ fields: toPlainFields(next), updatedBy: actor.id });
    await table.save();
    refresh();
    return null;
  });
}


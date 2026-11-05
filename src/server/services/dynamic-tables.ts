import "server-only";
import { randomBytes } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { DynamicTable } from "../db/models/dynamic-table";
import { DynamicRecord } from "../db/models/dynamic-record";
import { can, type CurrentUser } from "../auth/dal";
import { formatValue, parseText, inputSchema, toStored } from "@/lib/dynamic/registry";
import type { FieldDef, FieldInput, FieldType, StoredValue, TableIcon, TableLevel } from "@/lib/dynamic/types";
import type { Currency } from "@/lib/constants";

export const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString("base64url")}`;

export type TableMeta = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: TableIcon;
  /** All fields (including archived), sorted by order. */
  fields: FieldDef[];
  schemaVersion: number;
  defaultLevel: Exclude<TableLevel, "manage">;
  roleAccess: { roleId: string; level: Exclude<TableLevel, "manage"> }[];
  archivedAt: string | null;
  /** The current user's effective access. */
  level: TableLevel;
};

type TableLean = {
  _id: unknown; name: string; slug: string; description?: string | null; icon?: string | null; fields: unknown[];
  schemaVersion?: number | null; defaultLevel?: string | null; roleAccess?: { roleId: unknown; level: string }[] | null;
  archivedAt?: Date | null;
};

/** Effective access: tables.manage → manage; else role override; else the table default. */
export function tableLevel(user: CurrentUser, table: Pick<TableLean, "defaultLevel" | "roleAccess">): TableLevel {
  if (!can(user, "tables.view")) return "none";
  if (can(user, "tables.manage")) return "manage";
  const override = table.roleAccess?.find((r) => String(r.roleId) === user.roleId);
  return (override?.level ?? table.defaultLevel ?? "edit") as TableLevel;
}

export const levelAtLeast = (level: TableLevel, needed: Exclude<TableLevel, "none">) =>
  ({ none: 0, view: 1, edit: 2, manage: 3 })[level] >= ({ view: 1, edit: 2, manage: 3 })[needed];

export function serializeField(raw: unknown): FieldDef {
  const f = raw as Record<string, unknown>;
  return {
    id: String(f.id),
    key: String(f.key),
    label: String(f.label),
    type: f.type as FieldType,
    placeholder: (f.placeholder as string) ?? "",
    helpText: (f.helpText as string) ?? "",
    required: Boolean(f.required),
    defaultValue: (f.defaultValue as FieldInput) ?? "",
    options: ((f.options as { id: string; label: string }[]) ?? []).map((o) => ({ id: o.id, label: o.label })),
    min: (f.min as number | null) ?? null,
    max: (f.max as number | null) ?? null,
    currency: ((f.currency as Currency) ?? "LKR"),
    order: (f.order as number) ?? 0,
    showInTable: f.showInTable !== false,
    showInForm: f.showInForm !== false,
    archivedAt: f.archivedAt ? new Date(f.archivedAt as Date).toISOString() : null,
  };
}

export function serializeTable(t: TableLean, user: CurrentUser): TableMeta {
  return {
    id: String(t._id),
    name: t.name,
    slug: t.slug,
    description: t.description ?? "",
    icon: (t.icon ?? "table") as TableIcon,
    fields: t.fields.map(serializeField).sort((a, b) => a.order - b.order),
    schemaVersion: t.schemaVersion ?? 1,
    defaultLevel: (t.defaultLevel ?? "edit") as TableMeta["defaultLevel"],
    roleAccess: (t.roleAccess ?? []).map((r) => ({ roleId: String(r.roleId), level: r.level as TableMeta["defaultLevel"] })),
    archivedAt: t.archivedAt?.toISOString() ?? null,
    level: tableLevel(user, t),
  };
}

export const activeFields = (fields: FieldDef[]) => fields.filter((f) => !f.archivedAt);

export function buildSearchText(fields: FieldDef[], data: Record<string, StoredValue>) {
  return activeFields(fields)
    .map((f) => formatValue(f, data[f.id]))
    .filter(Boolean)
    .join(" · ")
    .toLowerCase()
    .slice(0, 4000);
}

/** Recomputes searchText for every record (after labels/options/fields change). */
export async function reindexTable(tableId: string, fields: FieldDef[]) {
  const cursor = DynamicRecord.find({ tableId, deletedAt: null }, { data: 1 }).lean().cursor();
  let ops: Parameters<typeof DynamicRecord.bulkWrite>[0] = [];
  for await (const r of cursor) {
    ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: { searchText: buildSearchText(fields, (r.data ?? {}) as Record<string, StoredValue>) } } } });
    if (ops.length >= 500) { await DynamicRecord.bulkWrite(ops); ops = []; }
  }
  if (ops.length) await DynamicRecord.bulkWrite(ops);
}

export type ConversionPreview = {
  total: number;
  withValue: number;
  convertible: number;
  failures: { recordId: string; value: string; reason: string }[];
  failureCount: number;
  /** Options that will be created automatically when converting to a dropdown. */
  newOptions: string[];
};

/** Option list for a conversion to select/multiselect: existing options + distinct values found. */
async function optionsForConversion(tableId: string, from: FieldDef, to: FieldDef) {
  if (to.type !== "select" && to.type !== "multiselect") return { options: to.options, created: [] as string[] };
  const records = await DynamicRecord.find({ tableId, deletedAt: null, [`data.${from.id}`]: { $nin: [null, "", []] } }, { [`data.${from.id}`]: 1 }).limit(5000).lean();
  const labels = new Set<string>();
  for (const r of records) {
    const text = formatValue(from, ((r as { data?: Record<string, StoredValue> }).data ?? {})[from.id]);
    const parts = to.type === "multiselect" && from.type !== "select" ? text.split(/[;,|]/) : [text];
    parts.map((p) => p.trim()).filter(Boolean).forEach((p) => labels.add(p));
  }
  const existing = new Set(to.options.map((o) => o.label.toLowerCase()));
  const created = [...labels].filter((l) => !existing.has(l.toLowerCase())).slice(0, 100);
  return { options: [...to.options, ...created.map((label) => ({ id: newId("opt"), label }))], created };
}

/**
 * Converts every record's value from `from` to `to` (same field id). Values that
 * can't be converted are moved to record.legacy[fieldId] — never discarded.
 * With dryRun, nothing is written and a preview is returned.
 */
export async function convertField(tableId: string, from: FieldDef, toDraft: FieldDef, dryRun: boolean, session?: ClientSession) {
  const { options, created } = await optionsForConversion(tableId, from, toDraft);
  const to = { ...toDraft, options };
  const rule = { ...to, required: false };
  const schema = inputSchema(rule);
  const preview: ConversionPreview = { total: 0, withValue: 0, convertible: 0, failures: [], failureCount: 0, newOptions: created };
  const cursor = DynamicRecord.find({ tableId: new Types.ObjectId(tableId), deletedAt: null }, { data: 1, legacy: 1 }).session(session ?? null).lean().cursor();
  let ops: Parameters<typeof DynamicRecord.bulkWrite>[0] = [];
  const now = new Date();

  for await (const r of cursor) {
    preview.total++;
    const data = (r.data ?? {}) as Record<string, StoredValue>;
    const old = data[from.id];
    if (old === null || old === undefined || old === "" || (Array.isArray(old) && !old.length)) continue;
    preview.withValue++;
    const text = from.type === "multiselect" && to.type === "multiselect" ? (old as string[]).map((id) => from.options.find((o) => o.id === id)?.label ?? id).join(";") : formatValue(from, old);
    const parsed = parseText(to, from.type === "currency" && to.type === "number" ? String((old as number) / 100) : text);
    const valid = parsed.ok && schema.safeParse(parsed.value).success;
    if (parsed.ok && valid) {
      preview.convertible++;
      if (!dryRun) ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: { [`data.${from.id}`]: toStored(to, parsed.value) } } } });
    } else {
      preview.failureCount++;
      if (preview.failures.length < 10) preview.failures.push({ recordId: String(r._id), value: text, reason: parsed.ok ? "Doesn't meet the field rules" : parsed.reason });
      if (!dryRun) {
        // Set the whole legacy object: new records hold `legacy: null`, which can't take a sub-field.
        const legacy = { ...((r.legacy as Record<string, unknown> | null) ?? {}), [from.id]: { value: old, fromType: from.type, at: now } };
        ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: { legacy, [`data.${from.id}`]: null } } } });
      }
    }
    if (ops.length >= 500) { await DynamicRecord.bulkWrite(ops, { session }); ops = []; }
  }
  if (!dryRun && ops.length) await DynamicRecord.bulkWrite(ops, { session });
  return { preview, field: to };
}

export async function loadTableOrThrow(tableId: string) {
  if (!Types.ObjectId.isValid(tableId)) return null;
  return DynamicTable.findOne({ _id: tableId, deletedAt: null });
}

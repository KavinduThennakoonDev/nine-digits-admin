"use server";

import { refresh } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/server/db/connect";
import { DynamicRecord } from "@/server/db/models/dynamic-record";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { activeFields, buildSearchText, levelAtLeast, loadTableOrThrow, serializeTable, type TableMeta } from "@/server/services/dynamic-tables";
import { AppError } from "@/server/errors";
import { runAction } from "@/server/action";
import { defaultInput, formatValue, inputSchema, parseText, toStored } from "@/lib/dynamic/registry";
import type { FieldInput, StoredValue } from "@/lib/dynamic/types";
import type { ActionResult } from "@/lib/action-result";

async function editableTable(tableId: string, actor: CurrentUser): Promise<TableMeta> {
  const table = await loadTableOrThrow(tableId);
  if (!table) throw new AppError("NOT_FOUND", "Table not found.");
  const meta = serializeTable(table.toObject(), actor);
  if (!levelAtLeast(meta.level, "edit")) throw new AppError("FORBIDDEN", "You can only view this table.");
  if (meta.archivedAt) throw new AppError("VALIDATION", "This table is archived. Restore it to make changes.");
  return meta;
}

/** Fields a person fills in on the form (active + shown in form). */
const formFields = (meta: TableMeta) => activeFields(meta.fields).filter((f) => f.showInForm);

const valueInput = z.union([z.string().max(10000), z.array(z.string().max(200)).max(200), z.boolean()]);
const recordInput = z.object({
  tableId: z.string(),
  id: z.string().optional(),
  values: z.record(z.string(), valueInput),
});
export type RecordInput = z.input<typeof recordInput>;

export async function saveRecordAction(input: RecordInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    const data = recordInput.parse(input);
    await connectDB();
    const meta = await editableTable(data.tableId, actor);

    // Validate every form field with its own rules (built from metadata).
    const fieldErrors: Record<string, string[]> = {};
    const stored: Record<string, StoredValue> = {};
    for (const f of formFields(meta)) {
      const raw = data.values[f.id] ?? (data.id ? undefined : defaultInput(f));
      if (raw === undefined) continue;
      const r = inputSchema(f).safeParse(raw);
      if (!r.success) fieldErrors[f.id] = [r.error.issues[0]?.message ?? "Invalid value."];
      else stored[f.id] = toStored(f, r.data);
    }
    if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION", "Please fix the highlighted fields.", fieldErrors);

    if (!data.id) {
      // Hidden-from-form fields still get their defaults on create.
      for (const f of activeFields(meta.fields).filter((x) => !x.showInForm)) stored[f.id] = toStored(f, defaultInput(f));
      const rec = await DynamicRecord.create({
        tableId: meta.id, data: stored, searchText: buildSearchText(meta.fields, stored), schemaVersion: meta.schemaVersion,
        createdBy: actor.id, updatedBy: actor.id,
      });
      await audit({ userId: actor.id, action: "create", module: `table:${meta.slug}`, recordId: String(rec._id), summary: `Added a record to “${meta.name}”` });
      refresh();
      return { id: String(rec._id) };
    }

    if (!Types.ObjectId.isValid(data.id)) throw new AppError("NOT_FOUND", "Record not found.");
    const rec = await DynamicRecord.findOne({ _id: data.id, tableId: meta.id, deletedAt: null });
    if (!rec) throw new AppError("NOT_FOUND", "Record not found.");
    // Merge: archived/hidden field values are preserved untouched.
    const before = { ...(rec.data as Record<string, StoredValue>) };
    const merged = { ...before, ...stored };
    const changed = formFields(meta).filter((f) => formatValue(f, before[f.id]) !== formatValue(f, merged[f.id]));
    // A set-aside value is resolved once the field holds a proper value again.
    const legacy = { ...((rec.legacy as Record<string, unknown> | null) ?? {}) };
    for (const [fid, v] of Object.entries(stored)) if (v !== null && v !== "" && fid in legacy) delete legacy[fid];
    rec.set({
      data: merged, legacy: Object.keys(legacy).length ? legacy : null,
      searchText: buildSearchText(meta.fields, merged), schemaVersion: meta.schemaVersion, updatedBy: actor.id,
    });
    rec.markModified("data");
    rec.markModified("legacy");
    await rec.save();
    if (changed.length) {
      await audit({
        userId: actor.id, action: "update", module: `table:${meta.slug}`, recordId: data.id,
        summary: `Edited a record in “${meta.name}”`,
        before: Object.fromEntries(changed.map((f) => [f.label, formatValue(f, before[f.id])])),
        after: Object.fromEntries(changed.map((f) => [f.label, formatValue(f, merged[f.id])])),
      });
    }
    refresh();
    return { id: data.id };
  });
}

export async function deleteRecordsAction(tableId: string, ids: string[]): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    await connectDB();
    const meta = await editableTable(tableId, actor);
    const valid = ids.filter((id) => Types.ObjectId.isValid(id)).slice(0, 500);
    const res = await DynamicRecord.updateMany({ _id: { $in: valid }, tableId: meta.id, deletedAt: null }, { $set: { deletedAt: new Date(), updatedBy: actor.id } });
    await audit({ userId: actor.id, action: "delete", module: `table:${meta.slug}`, recordId: null, summary: `Deleted ${res.modifiedCount} record(s) from “${meta.name}”` });
    refresh();
    return { count: res.modifiedCount };
  });
}

/* ── CSV import ──────────────────────────────────────────── */

const MAX_IMPORT_ROWS = 5000;
const importInput = z.object({
  tableId: z.string(),
  /** Column index (as string) → field id. Unmapped columns are ignored. */
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.array(z.string().max(10000)).max(200)).max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`),
  dryRun: z.boolean(),
});
export type ImportInput = z.input<typeof importInput>;
export type ImportReport = { total: number; valid: number; invalid: number; imported: number; errors: { row: number; messages: string[] }[] };

/** Validates every row against the field rules; inserts the valid ones unless dryRun. */
export async function importRecordsAction(input: ImportInput): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const actor = await authorize("tables.view");
    const data = importInput.parse(input);
    await connectDB();
    const meta = await editableTable(data.tableId, actor);
    const fields = activeFields(meta.fields);
    const byId = new Map(fields.map((f) => [f.id, f]));
    const mapped = Object.entries(data.mapping).filter(([, fid]) => byId.has(fid)).map(([col, fid]) => [Number(col), byId.get(fid)!] as const);
    if (!mapped.length) throw new AppError("VALIDATION", "Map at least one column to a field.");

    const report: ImportReport = { total: data.rows.length, valid: 0, invalid: 0, imported: 0, errors: [] };
    const docs: { data: Record<string, StoredValue>; searchText: string }[] = [];
    data.rows.forEach((row, i) => {
      const messages: string[] = [];
      const inputs = new Map<string, FieldInput>(fields.map((f) => [f.id, defaultInput(f)]));
      for (const [col, f] of mapped) {
        const parsed = parseText(f, row[col] ?? "");
        if (!parsed.ok) messages.push(`${f.label}: ${parsed.reason}`);
        else inputs.set(f.id, parsed.value);
      }
      const stored: Record<string, StoredValue> = {};
      for (const f of fields) {
        const r = inputSchema(f).safeParse(inputs.get(f.id));
        if (!r.success) { if (!messages.some((m) => m.startsWith(`${f.label}:`))) messages.push(`${f.label}: ${r.error.issues[0]?.message}`); }
        else stored[f.id] = toStored(f, r.data);
      }
      if (messages.length) {
        report.invalid++;
        if (report.errors.length < 100) report.errors.push({ row: i + 2, messages }); // +2: header row + 1-based
      } else {
        report.valid++;
        docs.push({ data: stored, searchText: buildSearchText(meta.fields, stored) });
      }
    });

    if (!data.dryRun && docs.length) {
      const now = new Date();
      await DynamicRecord.insertMany(docs.map((d) => ({
        tableId: meta.id, ...d, schemaVersion: meta.schemaVersion, createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now,
      })));
      report.imported = docs.length;
      await audit({ userId: actor.id, action: "import", module: `table:${meta.slug}`, recordId: null, summary: `Imported ${docs.length} record(s) into “${meta.name}”${report.invalid ? `, skipped ${report.invalid} invalid` : ""}` });
      refresh();
    }
    return report;
  });
}


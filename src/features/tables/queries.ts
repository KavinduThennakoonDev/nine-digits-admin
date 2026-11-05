import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { DynamicTable } from "@/server/db/models/dynamic-table";
import { DynamicRecord } from "@/server/db/models/dynamic-record";
import { Role } from "@/server/db/models/role";
import { User } from "@/server/db/models/user";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { activeFields, serializeTable, type TableMeta } from "@/server/services/dynamic-tables";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { isFilterable, isSortable } from "@/lib/dynamic/registry";
import type { FieldDef, StoredValue } from "@/lib/dynamic/types";

export type TableSummary = Pick<TableMeta, "id" | "name" | "slug" | "description" | "icon" | "level" | "archivedAt"> & {
  fieldCount: number; recordCount: number; updatedAt: string;
};

/** Tables the user can see (level ≠ none), with record counts. */
export async function listTables(user: CurrentUser, opts: { includeArchived?: boolean } = {}): Promise<TableSummary[]> {
  await connectDB();
  if (!user.permissions.includes("tables.view")) return [];
  const tables = await DynamicTable.find({ deletedAt: null, ...(opts.includeArchived ? {} : { archivedAt: null }) }).sort({ name: 1 }).lean();
  const counts = await DynamicRecord.aggregate<{ _id: unknown; n: number }>([
    { $match: { tableId: { $in: tables.map((t) => t._id) }, deletedAt: null } },
    { $group: { _id: "$tableId", n: { $sum: 1 } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  return tables
    .map((t) => ({ meta: serializeTable(t, user), updatedAt: (t.updatedAt as Date).toISOString() }))
    .filter(({ meta }) => meta.level !== "none")
    .map(({ meta, updatedAt }) => ({
      id: meta.id, name: meta.name, slug: meta.slug, description: meta.description, icon: meta.icon, level: meta.level,
      archivedAt: meta.archivedAt, fieldCount: activeFields(meta.fields).length, recordCount: map.get(meta.id) ?? 0, updatedAt,
    }));
}

/** Null when missing or not visible to the user. */
export async function getTable(slug: string, user: CurrentUser): Promise<TableMeta | null> {
  await authorize("tables.view");
  await connectDB();
  const t = await DynamicTable.findOne({ slug, deletedAt: null }).lean();
  if (!t) return null;
  const meta = serializeTable(t, user);
  return meta.level === "none" ? null : meta;
}

export type RecordRow = {
  id: string;
  /** Wire values (dates as ISO strings). */
  data: Record<string, StoredValue>;
  hasLegacy: boolean;
  /** Values set aside by a type change, as text: { [fieldId]: "old value" }. */
  legacy: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
};

const wire = (v: unknown): StoredValue => (v instanceof Date ? v.toISOString() : (v as StoredValue));

/** Mongo filter for search + per-field filters (?f_<fieldId>=value). Shared with export. */
export function buildRecordFilter(meta: TableMeta, sp: SearchParams) {
  const filter: Record<string, unknown> = { tableId: new Types.ObjectId(meta.id), deletedAt: null };
  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) filter.searchText = new RegExp(escapeRegex(q.toLowerCase()));
  for (const f of activeFields(meta.fields).filter((x) => isFilterable(x.type))) {
    const v = first(sp[`f_${f.id}`]);
    if (!v) continue;
    if (f.type === "checkbox" || f.type === "boolean") filter[`data.${f.id}`] = v === "true" ? true : { $ne: true };
    else if (f.type === "multiselect") filter[`data.${f.id}`] = v;
    else filter[`data.${f.id}`] = v;
  }
  return filter;
}

export function recordSort(meta: TableMeta, sp: SearchParams): { key: string; dir: 1 | -1 } {
  const sortable = ["createdAt", "updatedAt", ...activeFields(meta.fields).filter((f) => isSortable(f.type)).map((f) => f.id)];
  const params = parseListParams(sp, sortable, "createdAt");
  const key = params.sort === "createdAt" || params.sort === "updatedAt" ? params.sort : `data.${params.sort}`;
  return { key, dir: params.dir === "asc" ? 1 : -1 };
}

export async function listRecords(meta: TableMeta, sp: SearchParams): Promise<Paginated<RecordRow>> {
  await connectDB();
  const params = parseListParams(sp, [], "createdAt");
  const filter = buildRecordFilter(meta, sp);
  const { key, dir } = recordSort(meta, sp);
  const [docs, total] = await Promise.all([
    DynamicRecord.find(filter).sort({ [key]: dir, _id: dir }).skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    DynamicRecord.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: docs.map((d) => d.createdBy).filter(Boolean) } }, { name: 1 }).lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return {
    rows: docs.map((d) => ({
      id: String(d._id),
      data: Object.fromEntries(Object.entries((d.data ?? {}) as Record<string, unknown>).map(([k, v]) => [k, wire(v)])),
      hasLegacy: !!d.legacy && Object.keys(d.legacy as object).length > 0,
      legacy: Object.fromEntries(Object.entries((d.legacy ?? {}) as Record<string, { value: unknown }>)
        .map(([k, v]) => [k, Array.isArray(v?.value) ? v.value.join(", ") : v?.value instanceof Date ? v.value.toISOString().slice(0, 10) : String(v?.value ?? "")])),
      createdAt: (d.createdAt as Date).toISOString(),
      updatedAt: (d.updatedAt as Date).toISOString(),
      createdByName: d.createdBy ? names.get(String(d.createdBy)) ?? null : null,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Counts of records with a value per field (shown in the structure editor). */
export async function fieldUsage(meta: TableMeta): Promise<Record<string, number>> {
  await connectDB();
  const out: Record<string, number> = {};
  await Promise.all(meta.fields.map(async (f: FieldDef) => {
    out[f.id] = await DynamicRecord.countDocuments({ tableId: new Types.ObjectId(meta.id), deletedAt: null, [`data.${f.id}`]: { $nin: [null, "", []] } });
  }));
  return out;
}

export async function legacyCount(meta: TableMeta) {
  await connectDB();
  return DynamicRecord.countDocuments({ tableId: new Types.ObjectId(meta.id), deletedAt: null, legacy: { $nin: [null, {}] } });
}

export async function getRoleOptions() {
  await connectDB();
  const roles = await Role.find({}, { name: 1, slug: 1 }).sort({ name: 1 }).lean();
  return roles.map((r) => ({ id: String(r._id), name: r.name, slug: r.slug }));
}

export async function recordCount(meta: TableMeta) {
  await connectDB();
  return DynamicRecord.countDocuments({ tableId: new Types.ObjectId(meta.id), deletedAt: null });
}

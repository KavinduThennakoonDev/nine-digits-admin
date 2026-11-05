import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { ActivityLog } from "@/server/db/models/activity-log";
import { User } from "@/server/db/models/user";
import { authorize } from "@/server/auth/dal";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { rangeMatch, resolveRange } from "@/lib/periods";

export type ActivityRow = {
  id: string;
  at: string;
  userId: string | null;
  userName: string;
  action: string;
  module: string;
  summary: string;
  link: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string;
};

/** Where a log entry's record lives in the app (null when there's no page for it). */
export function recordLink(module: string, recordId: string | null): string | null {
  if (module.startsWith("table:")) return `/tables/${module.slice(6)}`;
  if (!recordId) return null;
  const map: Record<string, string> = {
    clients: "/clients/", leads: "/leads/", invoices: "/finance/invoices/", projects: "/projects/", tasks: "/tasks/", users: "/team/",
  };
  return map[module] ? `${map[module]}${recordId}` : null;
}

export function buildActivityFilter(sp: SearchParams) {
  const filter: Record<string, unknown> = {};
  const range = rangeMatch(resolveRange(sp, "all"));
  if (range) filter.createdAt = range;
  const user = first(sp.user);
  if (user && Types.ObjectId.isValid(user)) filter.userId = new Types.ObjectId(user);
  const mod = first(sp.module);
  if (mod) filter.module = mod === "tables" ? { $regex: /^table:|^tables$/ } : mod;
  const action = first(sp.action);
  if (action) filter.action = action;
  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) filter.summary = new RegExp(escapeRegex(q), "i");
  return filter;
}

export async function listActivity(sp: SearchParams): Promise<Paginated<ActivityRow>> {
  await authorize("activity.view");
  await connectDB();
  const params = parseListParams(sp, ["createdAt"], "createdAt");
  const filter = buildActivityFilter(sp);
  const [docs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: params.dir === "asc" ? 1 : -1, _id: -1 }).skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    ActivityLog.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: docs.map((d) => d.userId).filter(Boolean) } }, { name: 1 }).lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return {
    rows: docs.map((d) => ({
      id: String(d._id),
      at: (d.createdAt as Date).toISOString(),
      userId: d.userId ? String(d.userId) : null,
      userName: d.userId ? names.get(String(d.userId)) ?? "Deleted user" : "System",
      action: d.action,
      module: d.module,
      summary: d.summary ?? "",
      link: recordLink(d.module, d.recordId ? String(d.recordId) : null),
      before: (d.before as Record<string, unknown> | null) ?? null,
      after: (d.after as Record<string, unknown> | null) ?? null,
      ip: d.ip ?? "",
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Distinct modules and actions for the filters (custom tables grouped as "tables"). */
export async function activityFacets() {
  await connectDB();
  const [modules, actions] = await Promise.all([ActivityLog.distinct("module"), ActivityLog.distinct("action")]);
  const mods = [...new Set((modules as string[]).map((m) => (m.startsWith("table:") ? "tables" : m)))].sort();
  return { modules: mods, actions: (actions as string[]).sort() };
}

import "server-only";
import { Types } from "mongoose";
import { can, type CurrentUser } from "../auth/dal";
import { User } from "../db/models/user";
import { WorkActivity } from "../db/models/work-activity";
import { AppError } from "../errors";
import type { TimelineItem } from "@/components/feedback/timeline";

const oid = (id: string) => new Types.ObjectId(id);

/** Projects visible to the user: all, or those they manage, belong to, or created. */
export function projectScope(user: CurrentUser): Record<string, unknown> {
  if (can(user, "projects.view_all")) return {};
  const me = oid(user.id);
  return { $or: [{ managerId: me }, { memberIds: me }, { createdBy: me }] };
}
export function canSeeProject(user: CurrentUser, p: { managerId?: unknown; memberIds?: unknown[] | null; createdBy?: unknown }) {
  if (can(user, "projects.view_all")) return true;
  return String(p.managerId) === user.id || String(p.createdBy) === user.id || (p.memberIds ?? []).some((m) => String(m) === user.id);
}

/** Tasks visible to the user: all, or those assigned to or created by them. */
export function taskScope(user: CurrentUser): Record<string, unknown> {
  if (can(user, "tasks.view_all")) return {};
  const me = oid(user.id);
  return { $or: [{ assigneeIds: me }, { createdBy: me }] };
}
export function canSeeTask(user: CurrentUser, t: { assigneeIds?: unknown[] | null; createdBy?: unknown }) {
  if (can(user, "tasks.view_all")) return true;
  return String(t.createdBy) === user.id || (t.assigneeIds ?? []).some((a) => String(a) === user.id);
}

export async function userNameMap(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }, { name: 1 }).lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

export async function logWork(entity: "project" | "task", entityId: Types.ObjectId | string, userId: string, type: "note" | "status_change" | "assignment" | "system", detail: string, body = "") {
  await WorkActivity.create({ entity, entityId, userId, type, body, meta: { detail } });
}

export async function workTimeline(entity: "project" | "task", entityId: string, limit = 200): Promise<TimelineItem[]> {
  const acts = await WorkActivity.find({ entity, entityId }).sort({ occurredAt: -1, _id: -1 }).limit(limit).lean();
  const names = await userNameMap(acts.map((a) => a.userId));
  return acts.map((a) => ({
    id: String(a._id),
    kind: a.type as string,
    at: (a.occurredAt as Date).toISOString(),
    userName: a.userId ? names.get(String(a.userId)) ?? null : null,
    body: a.body ?? "",
    detail: (a.meta as { detail?: string } | null)?.detail,
  }));
}

/** Active users among `ids` (validates assignee/member pickers). */
export async function assertActiveUsers(ids: string[], field: string) {
  if (!ids.length) return;
  const n = await User.countDocuments({ _id: { $in: ids }, status: "active" });
  if (n !== new Set(ids).size) {
    throw new AppError("VALIDATION", "Someone you picked is no longer an active team member.", { [field]: ["Remove inactive people."] });
  }
}

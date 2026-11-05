import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Task } from "@/server/db/models/task";
import { TaskComment } from "@/server/db/models/task-comment";
import { Project } from "@/server/db/models/project";
import { Client } from "@/server/db/models/client";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import { canSeeTask, taskScope, userNameMap, workTimeline } from "@/server/services/work";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { OPEN_TASK_STATUSES, PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/constants";
import { startOfAgencyDay, toDayString } from "@/lib/format";
import type { TimelineItem } from "@/components/feedback/timeline";

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  overdue: boolean;
  dueToday: boolean;
  assignees: { id: string; name: string }[];
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  commentCount: number;
  canUpdateStatus: boolean;
};

export const TASK_SORTABLE = ["dueDate", "createdAt", "updatedAt", "title"] as const;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function buildFilter(sp: SearchParams, user: CurrentUser) {
  const filter: Record<string, unknown> = { deletedAt: null, ...taskScope(user) };
  const and: Record<string, unknown>[] = [];
  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) and.push({ title: new RegExp(escapeRegex(q), "i") });
  const status = first(sp.status) ?? "open";
  if (status === "open") filter.status = { $in: OPEN_TASK_STATUSES };
  else if ((TASK_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const priority = first(sp.priority);
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) filter.priority = priority;
  const project = first(sp.project);
  if (project && Types.ObjectId.isValid(project)) filter.projectId = new Types.ObjectId(project);
  const assignee = first(sp.assignee);
  if (assignee === "me") and.push({ assigneeIds: new Types.ObjectId(user.id) });
  else if (assignee === "none") and.push({ assigneeIds: { $size: 0 } });
  else if (assignee && Types.ObjectId.isValid(assignee)) and.push({ assigneeIds: new Types.ObjectId(assignee) });
  const due = first(sp.due);
  const today = startOfAgencyDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (due === "overdue") and.push({ dueDate: { $lt: today }, status: { $in: OPEN_TASK_STATUSES } });
  else if (due === "today") and.push({ dueDate: { $gte: today, $lt: tomorrow } });
  else if (due === "week") and.push({ dueDate: { $gte: today, $lt: new Date(today.getTime() + 7 * 86_400_000) } });
  if (and.length) filter.$and = and;
  return filter;
}

async function toRows(docs: unknown[], user: CurrentUser): Promise<TaskRow[]> {
  const tasks = docs as unknown as {
    _id: unknown; title: string; status: string; priority: string; dueDate?: Date | null; assigneeIds: unknown[];
    projectId?: unknown; clientId?: unknown; commentCount?: number;
  }[];
  const [names, projects, clients] = await Promise.all([
    userNameMap(tasks.flatMap((t) => t.assigneeIds)),
    Project.find({ _id: { $in: tasks.map((t) => t.projectId).filter(Boolean) } }, { name: 1 }).lean(),
    Client.find({ _id: { $in: tasks.map((t) => t.clientId).filter(Boolean) } }, { clientName: 1 }).lean(),
  ]);
  const pMap = new Map(projects.map((p) => [String(p._id), p.name]));
  const cMap = new Map(clients.map((c) => [String(c._id), c.clientName]));
  const today = startOfAgencyDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  return tasks.map((t) => {
    const open = (OPEN_TASK_STATUSES as string[]).includes(t.status);
    return {
      id: String(t._id),
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as Priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      overdue: !!t.dueDate && open && t.dueDate < today,
      dueToday: !!t.dueDate && open && t.dueDate >= today && t.dueDate < tomorrow,
      assignees: t.assigneeIds.map((a) => ({ id: String(a), name: names.get(String(a)) ?? "Unknown" })),
      projectId: t.projectId ? String(t.projectId) : null,
      projectName: t.projectId ? pMap.get(String(t.projectId)) ?? null : null,
      clientName: t.clientId ? cMap.get(String(t.clientId)) ?? null : null,
      commentCount: t.commentCount ?? 0,
      canUpdateStatus: can(user, "tasks.manage") || t.assigneeIds.some((a) => String(a) === user.id),
    };
  });
}

export async function listTasks(sp: SearchParams): Promise<Paginated<TaskRow>> {
  const user = await authorize("tasks.view");
  await connectDB();
  const params = parseListParams(sp, TASK_SORTABLE, "dueDate");
  const filter = buildFilter(sp, user);
  const dir = params.dir === "asc" ? 1 : -1;
  const [docs, total] = await Promise.all([
    Task.find(filter).sort({ [params.sort]: params.sort === "dueDate" && !first(sp.dir) ? 1 : dir, createdAt: -1 })
      .skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Task.countDocuments(filter),
  ]);
  return { rows: await toRows(docs, user), total, page: params.page, pageSize: params.pageSize, pageCount: Math.max(1, Math.ceil(total / params.pageSize)) };
}

/** Board view: every column at once (done limited to the 30 most recent). */
export async function listTaskBoard(sp: SearchParams): Promise<Record<TaskStatus, TaskRow[]>> {
  const user = await authorize("tasks.view");
  await connectDB();
  const filter = buildFilter({ ...sp, status: "__all" }, user);
  delete (filter as { status?: unknown }).status;
  const [open, done] = await Promise.all([
    Task.find({ ...filter, status: { $in: OPEN_TASK_STATUSES } }).sort({ dueDate: 1, createdAt: -1 }).limit(300).lean(),
    Task.find({ ...filter, status: "done" }).sort({ completedAt: -1 }).limit(30).lean(),
  ]);
  const rows = await toRows([...open, ...done], user);
  const board = { todo: [], in_progress: [], review: [], done: [], cancelled: [] } as Record<TaskStatus, TaskRow[]>;
  for (const r of rows) board[r.status].push(r);
  for (const k of Object.keys(board) as TaskStatus[]) {
    board[k].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  }
  return board;
}

export type TaskComment = { id: string; userId: string; userName: string; body: string; createdAt: string; mine: boolean };
export type TaskDetail = TaskRow & {
  description: string;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
  comments: TaskComment[];
  timeline: TimelineItem[];
  form: { id: string; title: string; description: string; projectId: string; clientId: string; assigneeIds: string[]; dueDate: string; priority: Priority; status: TaskStatus };
};

export async function getTask(id: string, user: CurrentUser): Promise<TaskDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const t = await Task.findOne({ _id: id, deletedAt: null }).lean();
  if (!t || !canSeeTask(user, t)) return null;
  const [[row], comments, timeline, names] = await Promise.all([
    toRows([t], user),
    TaskComment.find({ taskId: t._id, deletedAt: null }).sort({ createdAt: 1 }).limit(500).lean(),
    workTimeline("task", String(t._id)),
    userNameMap([t.createdBy]),
  ]);
  const commenters = await userNameMap(comments.map((c) => c.userId));
  return {
    ...row,
    description: t.description ?? "",
    createdByName: t.createdBy ? names.get(String(t.createdBy)) ?? null : null,
    createdAt: (t.createdAt as Date).toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    comments: comments.map((c) => ({
      id: String(c._id), userId: String(c.userId), userName: commenters.get(String(c.userId)) ?? "Unknown", body: c.body,
      createdAt: (c.createdAt as Date).toISOString(), mine: String(c.userId) === user.id,
    })),
    timeline,
    form: {
      id: String(t._id), title: t.title, description: t.description ?? "", projectId: t.projectId ? String(t.projectId) : "",
      clientId: t.clientId ? String(t.clientId) : "", assigneeIds: t.assigneeIds.map(String), dueDate: toDayString(t.dueDate),
      priority: t.priority as Priority, status: t.status as TaskStatus,
    },
  };
}

/** The user's own open tasks, most urgent first (dashboard). */
export async function getMyOpenTasks(user: CurrentUser, limit = 6): Promise<TaskRow[]> {
  if (!user.permissions.includes("tasks.view")) return [];
  await connectDB();
  const docs = await Task.find({ deletedAt: null, status: { $in: OPEN_TASK_STATUSES }, assigneeIds: new Types.ObjectId(user.id) })
    .sort({ dueDate: 1, createdAt: -1 }).limit(50).lean();
  const rows = await toRows(docs, user);
  // Tasks with a due date first (soonest), then by priority.
  return rows.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]).slice(0, limit);
}

export async function countOpenTasks(user: CurrentUser) {
  await connectDB();
  const today = startOfAgencyDay();
  const scope = { deletedAt: null, status: { $in: OPEN_TASK_STATUSES }, ...taskScope(user) };
  const [open, overdue] = await Promise.all([
    Task.countDocuments(scope),
    Task.countDocuments({ ...scope, dueDate: { $lt: today } }),
  ]);
  return { open, overdue };
}

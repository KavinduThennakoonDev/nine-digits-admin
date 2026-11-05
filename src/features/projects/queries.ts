import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Project } from "@/server/db/models/project";
import { Task } from "@/server/db/models/task";
import { Expense } from "@/server/db/models/expense";
import { Client } from "@/server/db/models/client";
import { Service } from "@/server/db/models/service";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { canSeeProject, projectScope, userNameMap, workTimeline } from "@/server/services/work";
import { getFx, toBase, toBaseExpr } from "@/server/services/fx";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import {
  OPEN_PROJECT_STATUSES, OPEN_TASK_STATUSES, PRIORITIES, PROJECT_STATUSES,
  type Currency, type Priority, type ProjectStatus, type TaskStatus,
} from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { startOfAgencyDay, toDayString } from "@/lib/format";
import type { TimelineItem } from "@/components/feedback/timeline";
import type { ComboOption } from "@/components/forms/combobox";

export type ProjectRow = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  status: ProjectStatus;
  priority: Priority;
  deadline: string | null;
  overdue: boolean;
  members: string[];
  managerName: string | null;
  tasksOpen: number;
  tasksDone: number;
  budgetBase: number | null;
  spentBase: number;
  base: Currency;
};

export const PROJECT_SORTABLE = ["name", "deadline", "createdAt", "priority"] as const;

const isOverdue = (status: string, deadline: Date | null | undefined) =>
  !!deadline && (OPEN_PROJECT_STATUSES as string[]).includes(status) && deadline < startOfAgencyDay();

async function spentByProject(ids: Types.ObjectId[], base: Currency) {
  const rows = await Expense.aggregate<{ _id: unknown; total: number }>([
    { $match: { projectId: { $in: ids }, deletedAt: null } },
    { $group: { _id: "$projectId", total: { $sum: toBaseExpr(base) } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

async function taskCounts(ids: Types.ObjectId[]) {
  const rows = await Task.aggregate<{ _id: { p: unknown; done: boolean }; n: number }>([
    { $match: { projectId: { $in: ids }, deletedAt: null, status: { $ne: "cancelled" } } },
    { $group: { _id: { p: "$projectId", done: { $eq: ["$status", "done"] } }, n: { $sum: 1 } } },
  ]);
  const map = new Map<string, { open: number; done: number }>();
  for (const r of rows) {
    const k = String(r._id.p);
    const v = map.get(k) ?? { open: 0, done: 0 };
    if (r._id.done) v.done += r.n; else v.open += r.n;
    map.set(k, v);
  }
  return map;
}

export async function listProjects(sp: SearchParams): Promise<Paginated<ProjectRow>> {
  const user = await authorize("projects.view");
  await connectDB();
  const params = parseListParams(sp, PROJECT_SORTABLE, "createdAt");
  const { base, usdToLkr } = await getFx();
  const filter: Record<string, unknown> = { deletedAt: null, ...projectScope(user) };
  const and: Record<string, unknown>[] = [];
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    const clients = await Client.find({ clientName: rx }, { _id: 1 }).limit(200).lean();
    and.push({ $or: [{ name: rx }, { clientId: { $in: clients.map((c) => c._id) } }] });
  }
  const status = first(sp.status);
  if (status === "open") filter.status = { $in: OPEN_PROJECT_STATUSES };
  else if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const priority = first(sp.priority);
  if (priority && (PRIORITIES as readonly string[]).includes(priority)) filter.priority = priority;
  const client = first(sp.client);
  if (client && Types.ObjectId.isValid(client)) filter.clientId = new Types.ObjectId(client);
  const member = first(sp.member);
  if (member === "me") and.push({ $or: [{ memberIds: new Types.ObjectId(user.id) }, { managerId: new Types.ObjectId(user.id) }] });
  if (and.length) filter.$and = and;

  const [docs, total] = await Promise.all([
    Project.find(filter).sort({ [params.sort]: params.dir === "asc" ? 1 : -1, _id: -1 })
      .skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Project.countDocuments(filter),
  ]);
  const ids = docs.map((d) => d._id);
  const [spent, counts, names, clients] = await Promise.all([
    spentByProject(ids, base),
    taskCounts(ids),
    userNameMap(docs.flatMap((d) => [d.managerId, ...d.memberIds])),
    Client.find({ _id: { $in: docs.map((d) => d.clientId).filter(Boolean) } }, { clientName: 1 }).lean(),
  ]);
  const cMap = new Map(clients.map((c) => [String(c._id), c.clientName]));
  return {
    rows: docs.map((p) => ({
      id: String(p._id),
      name: p.name,
      clientId: p.clientId ? String(p.clientId) : null,
      clientName: p.clientId ? cMap.get(String(p.clientId)) ?? null : null,
      status: p.status as ProjectStatus,
      priority: p.priority as Priority,
      deadline: p.deadline?.toISOString() ?? null,
      overdue: isOverdue(p.status as string, p.deadline),
      members: p.memberIds.map((m) => names.get(String(m))).filter(Boolean) as string[],
      managerName: p.managerId ? names.get(String(p.managerId)) ?? null : null,
      tasksOpen: counts.get(String(p._id))?.open ?? 0,
      tasksDone: counts.get(String(p._id))?.done ?? 0,
      budgetBase: p.budget?.amount == null ? null : toBase(p.budget.amount, (p.budget.currency ?? "LKR") as Currency, usdToLkr, base),
      spentBase: spent.get(String(p._id)) ?? 0,
      base,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export type ProjectTask = { id: string; title: string; status: TaskStatus; priority: Priority; dueDate: string | null; assignees: string[]; overdue: boolean };
export type ProjectExpense = { id: string; name: string; amount: number; currency: Currency; expenseDate: string };

export type ProjectDetail = {
  id: string;
  name: string;
  client: { id: string; name: string } | null;
  services: { id: string; name: string }[];
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  deadline: string | null;
  overdue: boolean;
  manager: { id: string; name: string } | null;
  members: { id: string; name: string }[];
  description: string;
  budget: { amount: number; currency: Currency } | null;
  budgetBase: number | null;
  spentBase: number;
  base: Currency;
  tasks: ProjectTask[];
  expenses: ProjectExpense[];
  expenseCount: number;
  timeline: TimelineItem[];
  createdAt: string;
  canManage: boolean;
  form: {
    id: string; name: string; clientId: string; serviceIds: string[]; budget: string; budgetCurrency: Currency; startDate: string;
    deadline: string; managerId: string; memberIds: string[]; status: ProjectStatus; priority: Priority; description: string;
  };
};

export async function getProject(id: string, user: CurrentUser): Promise<ProjectDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const p = await Project.findOne({ _id: id, deletedAt: null }).lean();
  if (!p || !canSeeProject(user, p)) return null;
  const { base, usdToLkr } = await getFx();
  const [client, services, tasks, expenses, expenseAgg, timeline] = await Promise.all([
    p.clientId ? Client.findById(p.clientId, { clientName: 1 }).lean() : null,
    Service.find({ _id: { $in: p.serviceIds } }, { name: 1 }).lean(),
    Task.find({ projectId: p._id, deletedAt: null }).sort({ status: 1, dueDate: 1 }).limit(200).lean(),
    Expense.find({ projectId: p._id, deletedAt: null }).sort({ expenseDate: -1 }).limit(10).lean(),
    Expense.aggregate<{ total: number; n: number }>([{ $match: { projectId: p._id, deletedAt: null } }, { $group: { _id: null, total: { $sum: toBaseExpr(base) }, n: { $sum: 1 } } }]),
    workTimeline("project", String(p._id)),
  ]);
  const names = await userNameMap([p.managerId, ...p.memberIds, ...tasks.flatMap((t) => t.assigneeIds)]);
  const today = startOfAgencyDay();
  const budget = p.budget?.amount == null ? null : { amount: p.budget.amount, currency: (p.budget.currency ?? "LKR") as Currency };
  return {
    id: String(p._id),
    name: p.name,
    client: client ? { id: String(client._id), name: client.clientName } : null,
    services: services.map((s) => ({ id: String(s._id), name: s.name })),
    status: p.status as ProjectStatus,
    priority: p.priority as Priority,
    startDate: p.startDate?.toISOString() ?? null,
    deadline: p.deadline?.toISOString() ?? null,
    overdue: isOverdue(p.status as string, p.deadline),
    manager: p.managerId ? { id: String(p.managerId), name: names.get(String(p.managerId)) ?? "Unknown" } : null,
    members: p.memberIds.map((m) => ({ id: String(m), name: names.get(String(m)) ?? "Unknown" })),
    description: p.description ?? "",
    budget,
    budgetBase: budget ? toBase(budget.amount, budget.currency, usdToLkr, base) : null,
    spentBase: expenseAgg[0]?.total ?? 0,
    base,
    tasks: tasks.map((t) => ({
      id: String(t._id), title: t.title, status: t.status as TaskStatus, priority: t.priority as Priority,
      dueDate: t.dueDate?.toISOString() ?? null, assignees: t.assigneeIds.map((a) => names.get(String(a)) ?? "Unknown"),
      overdue: !!t.dueDate && (OPEN_TASK_STATUSES as string[]).includes(t.status as string) && t.dueDate < today,
    })),
    expenses: expenses.map((e) => ({ id: String(e._id), name: e.name, amount: e.amount, currency: e.currency as Currency, expenseDate: e.expenseDate.toISOString() })),
    expenseCount: expenseAgg[0]?.n ?? 0,
    timeline,
    createdAt: (p.createdAt as Date).toISOString(),
    canManage: user.permissions.includes("projects.manage"),
    form: {
      id: String(p._id), name: p.name, clientId: p.clientId ? String(p.clientId) : "", serviceIds: p.serviceIds.map(String),
      budget: minorToAmount(budget?.amount), budgetCurrency: budget?.currency ?? "LKR", startDate: toDayString(p.startDate),
      deadline: toDayString(p.deadline), managerId: p.managerId ? String(p.managerId) : "", memberIds: p.memberIds.map(String),
      status: p.status as ProjectStatus, priority: p.priority as Priority, description: p.description ?? "",
    },
  };
}

/** Projects the user can see, for pickers (tasks, expenses). */
export async function getProjectOptions(user: CurrentUser, includeIds: string[] = []): Promise<(ComboOption & { clientId: string | null })[]> {
  await connectDB();
  if (!user.permissions.includes("projects.view") && !user.permissions.includes("expenses.manage") && !user.permissions.includes("tasks.manage")) return [];
  const scope = user.permissions.includes("projects.view_all") || user.permissions.includes("expenses.manage") ? {} : projectScope(user);
  const ids = includeIds.filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i));
  const docs = await Project.find({
    deletedAt: null,
    $or: [{ status: { $in: OPEN_PROJECT_STATUSES }, ...scope }, { _id: { $in: ids } }],
  }, { name: 1, clientId: 1, status: 1 }).sort({ name: 1 }).limit(500).lean();
  const clients = await Client.find({ _id: { $in: docs.map((d) => d.clientId).filter(Boolean) } }, { clientName: 1 }).lean();
  const cMap = new Map(clients.map((c) => [String(c._id), c.clientName]));
  return docs.map((d) => ({
    value: String(d._id), label: d.name, hint: d.clientId ? cMap.get(String(d.clientId)) : undefined, clientId: d.clientId ? String(d.clientId) : null,
  }));
}

/** Count of open projects the user can see (dashboard). */
export async function countActiveProjects(user: CurrentUser) {
  await connectDB();
  return Project.countDocuments({ deletedAt: null, status: { $in: ["planning", "in_progress"] }, ...projectScope(user) });
}

/** A client's projects (respecting project visibility). */
export async function getClientProjects(clientId: string, user: CurrentUser) {
  if (!Types.ObjectId.isValid(clientId) || !user.permissions.includes("projects.view")) return [];
  await connectDB();
  const docs = await Project.find({ clientId: new Types.ObjectId(clientId), deletedAt: null, ...projectScope(user) })
    .sort({ status: 1, deadline: 1 }).limit(50).lean();
  return docs.map((p) => ({
    id: String(p._id), name: p.name, status: p.status as ProjectStatus, deadline: p.deadline?.toISOString() ?? null,
    overdue: isOverdue(p.status as string, p.deadline),
  }));
}

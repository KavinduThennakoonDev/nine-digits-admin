import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/db/models/user";
import { Role } from "@/server/db/models/role";
import { Task } from "@/server/db/models/task";
import { Project } from "@/server/db/models/project";
import { Client } from "@/server/db/models/client";
import { Lead } from "@/server/db/models/lead";
import { ActivityLog } from "@/server/db/models/activity-log";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import {
  OPEN_PROJECT_STATUSES, OPEN_TASK_STATUSES,
  type Priority, type ProjectStatus, type TaskStatus, type UserStatus,
} from "@/lib/constants";
import { startOfAgencyDay } from "@/lib/format";
import { getClosedLeadStatuses } from "@/server/services/lead-statuses";

async function countBy(model: typeof Task | typeof Project | typeof Client | typeof Lead, field: string, match: Record<string, unknown>) {
  const rows = await (model as typeof Task).aggregate<{ _id: unknown; n: number }>([
    { $match: match },
    ...(field.endsWith("Ids") ? [{ $unwind: `$${field}` }] : []),
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  roleName: string;
  status: UserStatus;
  lastLoginAt: string | null;
  openTasks: number;
  overdueTasks: number;
  activeProjects: number;
  clients: number;
  openLeads: number;
};

export async function listTeam(): Promise<TeamMember[]> {
  await authorize("employees.view");
  await connectDB();
  const today = startOfAgencyDay();
  const CLOSED_LEAD_STATUSES = await getClosedLeadStatuses();
  const [users, roles, tasks, overdue, projects, clients, leads] = await Promise.all([
    User.find().sort({ status: 1, name: 1 }).lean(),
    Role.find({}, { name: 1 }).lean(),
    countBy(Task, "assigneeIds", { deletedAt: null, status: { $in: OPEN_TASK_STATUSES } }),
    countBy(Task, "assigneeIds", { deletedAt: null, status: { $in: OPEN_TASK_STATUSES }, dueDate: { $lt: today } }),
    // Each person once per project, whether manager, member or both.
    Project.aggregate<{ _id: unknown; n: number }>([
      { $match: { deletedAt: null, status: { $in: OPEN_PROJECT_STATUSES } } },
      { $project: { people: { $setUnion: [{ $ifNull: ["$memberIds", []] }, { $cond: [{ $ifNull: ["$managerId", false] }, ["$managerId"], []] }] } } },
      { $unwind: "$people" },
      { $group: { _id: "$people", n: { $sum: 1 } } },
    ]).then((rows) => new Map(rows.map((r) => [String(r._id), r.n]))),
    countBy(Client, "assignedTo", { deletedAt: null, archivedAt: null }),
    countBy(Lead, "assignedTo", { deletedAt: null, archivedAt: null, status: { $nin: CLOSED_LEAD_STATUSES } }),
  ]);
  const roleMap = new Map(roles.map((r) => [String(r._id), r.name]));
  return users.map((u) => {
    const id = String(u._id);
    return {
      id, name: u.name, email: u.email, phone: u.phone ?? "", jobTitle: u.jobTitle ?? "",
      roleName: roleMap.get(String(u.roleId)) ?? "—", status: u.status as UserStatus,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      openTasks: tasks.get(id) ?? 0, overdueTasks: overdue.get(id) ?? 0,
      activeProjects: projects.get(id) ?? 0,
      clients: clients.get(id) ?? 0, openLeads: leads.get(id) ?? 0,
    };
  });
}

export type MemberProfile = TeamMember & {
  createdAt: string;
  projects: { id: string; name: string; status: ProjectStatus; role: "Manager" | "Member"; deadline: string | null }[];
  tasks: { id: string; title: string; status: TaskStatus; priority: Priority; dueDate: string | null; overdue: boolean }[];
  activity: { id: string; action: string; module: string; summary: string; createdAt: string }[] | null;
};

export async function getMember(id: string, viewer: CurrentUser): Promise<MemberProfile | null> {
  await authorize("employees.view");
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const team = await listTeam();
  const base = team.find((m) => m.id === id);
  if (!base) return null;
  const oid = new Types.ObjectId(id);
  const today = startOfAgencyDay();
  const seeActivity = can(viewer, "activity.view") || viewer.id === id;
  const [user, projects, tasks, activity] = await Promise.all([
    User.findById(oid, { createdAt: 1 }).lean(),
    Project.find({ deletedAt: null, $or: [{ managerId: oid }, { memberIds: oid }] }).sort({ status: 1, deadline: 1 }).limit(50).lean(),
    Task.find({ deletedAt: null, assigneeIds: oid, status: { $in: OPEN_TASK_STATUSES } }).sort({ dueDate: 1 }).limit(50).lean(),
    seeActivity ? ActivityLog.find({ userId: oid }).sort({ createdAt: -1 }).limit(25).lean() : null,
  ]);
  return {
    ...base,
    createdAt: (user?.createdAt as Date | undefined)?.toISOString() ?? new Date(0).toISOString(),
    projects: projects.map((p) => ({
      id: String(p._id), name: p.name, status: p.status as ProjectStatus, role: String(p.managerId) === id ? "Manager" : "Member",
      deadline: p.deadline?.toISOString() ?? null,
    })),
    tasks: tasks.map((t) => ({
      id: String(t._id), title: t.title, status: t.status as TaskStatus, priority: t.priority as Priority,
      dueDate: t.dueDate?.toISOString() ?? null, overdue: !!t.dueDate && t.dueDate < today,
    })),
    activity: activity
      ? activity.map((a) => ({ id: String(a._id), action: a.action, module: a.module, summary: a.summary ?? "", createdAt: (a.createdAt as Date).toISOString() }))
      : null,
  };
}

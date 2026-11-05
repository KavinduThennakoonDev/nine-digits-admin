import "server-only";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/db/models/user";
import { ActivityLog } from "@/server/db/models/activity-log";
import { can, type CurrentUser } from "@/server/auth/dal";
import { Client } from "@/server/db/models/client";
import { Lead } from "@/server/db/models/lead";
import { assignedScope } from "@/server/auth/scope";
import { CLOSED_LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/lib/constants";
import { startOfAgencyDay } from "@/lib/format";

export type ActivityItem = {
  id: string;
  userName: string;
  action: string;
  module: string;
  summary: string;
  createdAt: string;
};

/** Everyone sees their own activity; activity.view unlocks the whole team's. */
export async function getRecentActivity(user: CurrentUser, limit = 8): Promise<{ items: ActivityItem[]; scope: "all" | "own" }> {
  await connectDB();
  const scope = can(user, "activity.view") ? "all" : "own";
  const logs = await ActivityLog.find(scope === "all" ? {} : { userId: user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const users = await User.find({ _id: { $in: [...new Set(logs.map((l) => String(l.userId)).filter(Boolean))] } }, { name: 1 }).lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return {
    scope,
    items: logs.map((l) => ({
      id: String(l._id),
      userName: names.get(String(l.userId)) ?? "System",
      action: l.action,
      module: l.module,
      summary: l.summary ?? "",
      createdAt: (l.createdAt as Date).toISOString(),
    })),
  };
}

/* ── CRM ─────────────────────────────────────────────────── */
function startOfAgencyMonth(now = new Date()) {
  const day = startOfAgencyDay(now);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit" }).format(day);
  return new Date(`${ymd}-01T00:00:00+05:30`);
}

export async function getCrmStats(user: CurrentUser) {
  await connectDB();
  const monthStart = startOfAgencyMonth();
  const clientBase = { deletedAt: null, archivedAt: null, ...assignedScope(user, "clients.view_all") };
  const leadBase = { deletedAt: null, archivedAt: null, ...assignedScope(user, "leads.view_all") };
  const now = new Date();
  const [clients, activeClients, leads, newLeads, convertedThisMonth, openLeads, overdue] = await Promise.all([
    can(user, "clients.view") ? Client.countDocuments(clientBase) : null,
    can(user, "clients.view") ? Client.countDocuments({ ...clientBase, status: "active" }) : null,
    can(user, "leads.view") ? Lead.countDocuments(leadBase) : null,
    can(user, "leads.view") ? Lead.countDocuments({ ...leadBase, leadDate: { $gte: monthStart } }) : null,
    can(user, "leads.view") ? Lead.countDocuments({ ...leadBase, convertedAt: { $gte: monthStart } }) : null,
    can(user, "leads.view") ? Lead.countDocuments({ ...leadBase, status: { $nin: CLOSED_LEAD_STATUSES } }) : null,
    can(user, "leads.view") ? Lead.countDocuments({ ...leadBase, status: { $nin: CLOSED_LEAD_STATUSES }, nextFollowUpAt: { $lt: now } }) : null,
  ]);
  return { clients, activeClients, leads, newLeads, convertedThisMonth, openLeads, overdue };
}

export type FollowUpItem = { id: string; fullName: string; company: string; status: LeadStatus; at: string; overdue: boolean; assignedName: string | null };

/** Overdue first, then the next 7 days. */
export async function getUpcomingFollowUps(user: CurrentUser, limit = 8): Promise<FollowUpItem[]> {
  await connectDB();
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const leads = await Lead.find({
    deletedAt: null, archivedAt: null, status: { $nin: CLOSED_LEAD_STATUSES },
    nextFollowUpAt: { $ne: null, $lte: horizon }, ...assignedScope(user, "leads.view_all"),
  }).sort({ nextFollowUpAt: 1 }).limit(limit).lean();
  const users = await User.find({ _id: { $in: leads.map((l) => l.assignedTo).filter(Boolean) } }, { name: 1 }).lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return leads.map((l) => ({
    id: String(l._id), fullName: l.fullName, company: l.company ?? "", status: l.status as LeadStatus,
    at: l.nextFollowUpAt!.toISOString(), overdue: l.nextFollowUpAt! < now,
    assignedName: l.assignedTo ? names.get(String(l.assignedTo)) ?? null : null,
  }));
}

export type RecentLead = { id: string; fullName: string; source: LeadSource; status: LeadStatus; createdAt: string };

export async function getRecentLeads(user: CurrentUser, limit = 6): Promise<RecentLead[]> {
  await connectDB();
  const leads = await Lead.find({ deletedAt: null, ...assignedScope(user, "leads.view_all") })
    .sort({ createdAt: -1 }).limit(limit).lean();
  return leads.map((l) => ({
    id: String(l._id), fullName: l.fullName, source: l.source as LeadSource, status: l.status as LeadStatus,
    createdAt: (l.createdAt as Date).toISOString(),
  }));
}
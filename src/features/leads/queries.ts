import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Lead } from "@/server/db/models/lead";
import { LeadActivity } from "@/server/db/models/lead-activity";
import { Client } from "@/server/db/models/client";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { assignedScope, canSeeAssigned } from "@/server/auth/scope";
import { parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { CALL_OUTCOME_OPTIONS, labelOf, type LeadSource, type LeadStatus } from "@/lib/constants";
import { formatDateTime, startOfAgencyDay, toDayString } from "@/lib/format";
import type { TimelineItem } from "@/components/feedback/timeline";
import { buildLeadFilter, openStatusFilter } from "./filters";
import { getClosedLeadStatuses } from "@/server/services/lead-statuses";

export type LeadRow = {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  source: LeadSource;
  status: LeadStatus;
  serviceName: string | null;
  assignedName: string | null;
  leadDate: string;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  overdue: boolean;
};

export const LEAD_SORTABLE = ["fullName", "status", "leadDate", "nextFollowUpAt", "lastContactedAt", "createdAt"] as const;

async function userNames(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }, { name: 1 }).lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}
async function serviceNames(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map<string, string>();
  const services = await Service.find({ _id: { $in: unique } }, { name: 1 }).lean();
  return new Map(services.map((s) => [String(s._id), s.name]));
}

const isOverdue = (at: Date | null | undefined, status: string, closed: string[]) =>
  !!at && at.getTime() < Date.now() && !closed.includes(status);

export async function listLeads(sp: SearchParams): Promise<Paginated<LeadRow>> {
  const user = await authorize("leads.view");
  await connectDB();
  const params = parseListParams(sp, LEAD_SORTABLE, "leadDate");
  const [filter, closed] = await Promise.all([buildLeadFilter(sp, user), getClosedLeadStatuses()]);

  const [docs, total] = await Promise.all([
    Lead.find(filter)
      .sort({ [params.sort]: params.dir === "asc" ? 1 : -1, createdAt: -1, _id: 1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  const [names, services] = await Promise.all([userNames(docs.map((d) => d.assignedTo)), serviceNames(docs.map((d) => d.interestedServiceId))]);

  return {
    rows: docs.map((l) => ({
      id: String(l._id),
      fullName: l.fullName,
      company: l.company ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      whatsapp: l.whatsapp ?? "",
      country: l.country ?? "",
      source: l.source as LeadSource,
      status: l.status as LeadStatus,
      serviceName: l.interestedServiceId ? services.get(String(l.interestedServiceId)) ?? null : null,
      assignedName: l.assignedTo ? names.get(String(l.assignedTo)) ?? "Unknown" : null,
      leadDate: (l.leadDate as Date).toISOString(),
      nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
      lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
      overdue: isOverdue(l.nextFollowUpAt, l.status as string, closed),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Counts for the follow-up quick filters, respecting row visibility. */
export async function getFollowUpCounts(user: CurrentUser) {
  await connectDB();
  const now = new Date();
  const endOfToday = new Date(startOfAgencyDay(now).getTime() + 86_400_000);
  const base = { deletedAt: null, archivedAt: null, status: await openStatusFilter(), ...assignedScope(user, "leads.view_all") };
  const [overdue, today] = await Promise.all([
    Lead.countDocuments({ ...base, nextFollowUpAt: { $lt: now } }),
    Lead.countDocuments({ ...base, nextFollowUpAt: { $gte: now, $lt: endOfToday } }),
  ]);
  return { overdue, today };
}

export async function getLeadCountries(user: CurrentUser): Promise<string[]> {
  await connectDB();
  const values = await Lead.distinct("country", { deletedAt: null, ...assignedScope(user, "leads.view_all") });
  return (values as string[]).filter(Boolean).sort();
}

export type LeadDetail = {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  source: LeadSource;
  status: LeadStatus;
  serviceId: string;
  serviceName: string | null;
  assignedTo: string;
  assignedName: string | null;
  leadDate: string;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  overdue: boolean;
  notes: string;
  convertedClient: { id: string; clientName: string } | null;
  convertedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  callCount: number;
  form: {
    id: string; fullName: string; email: string; phone: string; whatsapp: string; country: string; company: string;
    interestedServiceId: string; source: LeadSource; status: LeadStatus; assignedTo: string; leadDate: string;
    nextFollowUpAt: string; notes: string;
  };
};

export async function getLead(id: string, user: CurrentUser): Promise<LeadDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const l = await Lead.findOne({ _id: id, deletedAt: null }).lean();
  if (!l || !canSeeAssigned(user, "leads.view_all", l.assignedTo)) return null;

  const [names, services, client, callCount, closed] = await Promise.all([
    userNames([l.assignedTo, l.createdBy]),
    serviceNames([l.interestedServiceId]),
    l.convertedClientId ? Client.findOne({ _id: l.convertedClientId, deletedAt: null }, { clientName: 1 }).lean() : null,
    LeadActivity.countDocuments({ leadId: l._id, type: "call" }),
    getClosedLeadStatuses(),
  ]);
  const nextFollowUpAt = l.nextFollowUpAt?.toISOString() ?? null;
  return {
    id: String(l._id),
    fullName: l.fullName,
    company: l.company ?? "",
    email: l.email ?? "",
    phone: l.phone ?? "",
    whatsapp: l.whatsapp ?? "",
    country: l.country ?? "",
    source: l.source as LeadSource,
    status: l.status as LeadStatus,
    serviceId: l.interestedServiceId ? String(l.interestedServiceId) : "",
    serviceName: l.interestedServiceId ? services.get(String(l.interestedServiceId)) ?? null : null,
    assignedTo: l.assignedTo ? String(l.assignedTo) : "",
    assignedName: l.assignedTo ? names.get(String(l.assignedTo)) ?? "Unknown" : null,
    leadDate: (l.leadDate as Date).toISOString(),
    nextFollowUpAt,
    lastContactedAt: l.lastContactedAt?.toISOString() ?? null,
    overdue: isOverdue(l.nextFollowUpAt, l.status as string, closed),
    notes: l.notes ?? "",
    convertedClient: client ? { id: String(client._id), clientName: client.clientName } : null,
    convertedAt: l.convertedAt?.toISOString() ?? null,
    archivedAt: l.archivedAt?.toISOString() ?? null,
    createdAt: (l.createdAt as Date).toISOString(),
    createdByName: l.createdBy ? names.get(String(l.createdBy)) ?? null : null,
    callCount,
    form: {
      id: String(l._id), fullName: l.fullName, email: l.email ?? "", phone: l.phone ?? "", whatsapp: l.whatsapp ?? "",
      country: l.country ?? "", company: l.company ?? "", interestedServiceId: l.interestedServiceId ? String(l.interestedServiceId) : "",
      source: l.source as LeadSource, status: l.status as LeadStatus, assignedTo: l.assignedTo ? String(l.assignedTo) : "",
      leadDate: toDayString(l.leadDate), nextFollowUpAt: nextFollowUpAt ?? "", notes: l.notes ?? "",
    },
  };
}

type LeadActivityLean = {
  _id: unknown; type: string; occurredAt: Date; outcome?: string | null; durationMin?: number | null;
  followUpAt?: Date | null; notes?: string | null; userId?: unknown; meta?: unknown;
};

/** Timeline entry for a lead activity — shared by the lead page and the converted client's page. */
export function leadActivityItem(a: LeadActivityLean, names: Map<string, string>): TimelineItem {
  const meta = (a.meta ?? {}) as { detail?: string };
  const parts = [
    a.outcome ? labelOf(CALL_OUTCOME_OPTIONS, a.outcome) : null,
    a.durationMin ? `${a.durationMin} min` : null,
    meta.detail ?? null,
    a.followUpAt ? `next follow-up ${formatDateTime(a.followUpAt)}` : null,
  ].filter(Boolean);
  return {
    id: String(a._id),
    kind: a.type,
    at: a.occurredAt.toISOString(),
    userName: a.userId ? names.get(String(a.userId)) ?? null : null,
    body: a.notes ?? "",
    detail: parts.join(" · ") || undefined,
  };
}

export async function getLeadActivityItems(leadId: string, limit = 300): Promise<TimelineItem[]> {
  await connectDB();
  const acts = await LeadActivity.find({ leadId }).sort({ occurredAt: -1, _id: -1 }).limit(limit).lean();
  const names = await userNames(acts.map((a) => a.userId));
  return acts.map((a) => leadActivityItem(a as LeadActivityLean, names));
}

export const getLeadTimeline = getLeadActivityItems;

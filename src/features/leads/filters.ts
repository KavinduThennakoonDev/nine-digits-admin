import "server-only";
import { Types, type QueryFilter } from "mongoose";
import type { LeadDoc } from "@/server/db/models/lead";
import { assignedScope } from "@/server/auth/scope";
import type { CurrentUser } from "@/server/auth/dal";
import { escapeRegex, first, type SearchParams } from "@/lib/list-params";
import { CLOSED_LEAD_STATUSES, LEAD_SOURCES, LEAD_STATUSES, type LeadSource, type LeadStatus } from "@/lib/constants";
import { startOfAgencyDay } from "@/lib/format";

export const OPEN_STATUS_FILTER = { $nin: CLOSED_LEAD_STATUSES };

/** Shared by the leads list and the CSV/Excel export so both always match. */
export function buildLeadFilter(sp: SearchParams, user: CurrentUser): QueryFilter<LeadDoc> {
  const archived = first(sp.view) === "archived";
  const filter: QueryFilter<LeadDoc> = {
    deletedAt: null,
    archivedAt: archived ? { $ne: null } : null,
    ...assignedScope(user, "leads.view_all"),
  };

  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ fullName: rx }, { company: rx }, { email: rx }, { phone: rx }, { whatsapp: rx }];
  }
  const status = first(sp.status);
  if (status === "open") filter.status = OPEN_STATUS_FILTER as never;
  else if (status && (LEAD_STATUSES as readonly string[]).includes(status)) filter.status = status as LeadStatus;
  const source = first(sp.source);
  if (source && (LEAD_SOURCES as readonly string[]).includes(source)) filter.source = source as LeadSource;
  const country = first(sp.country);
  if (country) filter.country = country;
  const service = first(sp.service);
  if (service && Types.ObjectId.isValid(service)) filter.interestedServiceId = new Types.ObjectId(service);
  const assignee = first(sp.assignee);
  if (assignee === "me") filter.assignedTo = new Types.ObjectId(user.id);
  else if (assignee === "none") filter.assignedTo = null;
  else if (assignee && Types.ObjectId.isValid(assignee)) filter.assignedTo = new Types.ObjectId(assignee);

  const followUp = first(sp.followUp);
  if (followUp) {
    const now = new Date();
    const endOfToday = new Date(startOfAgencyDay(now).getTime() + 24 * 60 * 60 * 1000);
    if (followUp === "overdue") Object.assign(filter, { nextFollowUpAt: { $lt: now }, status: OPEN_STATUS_FILTER });
    else if (followUp === "today") Object.assign(filter, { nextFollowUpAt: { $gte: now, $lt: endOfToday }, status: OPEN_STATUS_FILTER });
    else if (followUp === "upcoming") Object.assign(filter, { nextFollowUpAt: { $gte: endOfToday }, status: OPEN_STATUS_FILTER });
    else if (followUp === "none") Object.assign(filter, { nextFollowUpAt: null, status: OPEN_STATUS_FILTER });
  }
  return filter;
}

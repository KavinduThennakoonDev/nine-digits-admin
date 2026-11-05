import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Client, type ClientDoc } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { Lead } from "@/server/db/models/lead";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { authorize, type CurrentUser } from "@/server/auth/dal";
import { assignedScope, canSeeAssigned } from "@/server/auth/scope";
import { escapeRegex, first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { CLIENT_STATUSES, CLIENT_TYPES, type ClientStatus, type ClientType, type Currency } from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { toDayString } from "@/lib/format";
import type { TimelineItem } from "@/components/feedback/timeline";
import { getLeadActivityItems } from "@/features/leads/queries";

export type ClientRow = {
  id: string;
  clientName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
  status: ClientStatus;
  clientType: ClientType;
  assignedName: string | null;
  retainerMinor: number | null;
  retainerCurrency: Currency;
  contractEnd: string | null;
  serviceCount: number;
  archived: boolean;
  createdAt: string;
};

export const CLIENT_SORTABLE = ["clientName", "status", "contractEnd", "createdAt", "monthlyRetainer.amount"] as const;

async function namesFor(ids: unknown[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }, { name: 1 }).lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

export async function listClients(sp: SearchParams): Promise<Paginated<ClientRow> & { archivedView: boolean }> {
  const user = await authorize("clients.view");
  await connectDB();
  const params = parseListParams(sp, CLIENT_SORTABLE, "createdAt");
  const archivedView = first(sp.view) === "archived";

  const filter: QueryFilter<ClientDoc> = { deletedAt: null, archivedAt: archivedView ? { $ne: null } : null, ...assignedScope(user, "clients.view_all") };
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), "i");
    filter.$or = [{ clientName: rx }, { companyName: rx }, { contactPerson: rx }, { email: rx }, { phone: rx }, { whatsapp: rx }];
  }
  const status = first(sp.status);
  if (status && (CLIENT_STATUSES as readonly string[]).includes(status)) filter.status = status as ClientStatus;
  const type = first(sp.type);
  if (type && (CLIENT_TYPES as readonly string[]).includes(type)) filter.clientType = type as ClientType;
  const country = first(sp.country);
  if (country) filter.country = country;
  const assignee = first(sp.assignee);
  if (assignee === "me") filter.assignedTo = new Types.ObjectId(user.id);
  else if (assignee === "none") filter.assignedTo = null;
  else if (assignee && Types.ObjectId.isValid(assignee)) filter.assignedTo = new Types.ObjectId(assignee);

  const [docs, total] = await Promise.all([
    Client.find(filter)
      .sort({ [params.sort]: params.dir === "asc" ? 1 : -1, _id: 1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean(),
    Client.countDocuments(filter),
  ]);
  const names = await namesFor(docs.map((d) => d.assignedTo));

  return {
    archivedView,
    rows: docs.map((c) => ({
      id: String(c._id),
      clientName: c.clientName,
      companyName: c.companyName ?? "",
      contactPerson: c.contactPerson ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      country: c.country ?? "",
      status: c.status as ClientStatus,
      clientType: c.clientType as ClientType,
      assignedName: c.assignedTo ? names.get(String(c.assignedTo)) ?? "Unknown" : null,
      retainerMinor: c.monthlyRetainer?.amount ?? null,
      retainerCurrency: (c.monthlyRetainer?.currency ?? "LKR") as Currency,
      contractEnd: c.contractEnd ? c.contractEnd.toISOString() : null,
      serviceCount: c.serviceIds?.length ?? 0,
      archived: !!c.archivedAt,
      createdAt: (c.createdAt as Date).toISOString(),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Distinct countries in use, for the filter dropdown. */
export async function getClientCountries(user: CurrentUser): Promise<string[]> {
  await connectDB();
  const values = await Client.distinct("country", { deletedAt: null, ...assignedScope(user, "clients.view_all") });
  return (values as string[]).filter(Boolean).sort();
}

export type ClientDetail = {
  id: string;
  clientName: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  country: string;
  industry: string;
  clientType: ClientType;
  status: ClientStatus;
  assignedTo: string;
  assignedName: string | null;
  services: { id: string; name: string }[];
  contractStart: string | null;
  contractEnd: string | null;
  retainerMinor: number | null;
  retainerCurrency: Currency;
  notes: string;
  sourceLead: { id: string; fullName: string; source: string; convertedAt: string | null } | null;
  archivedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  /** Values for the edit form. */
  form: {
    id: string; clientName: string; companyName: string; contactPerson: string; email: string; phone: string; whatsapp: string;
    address: string; country: string; industry: string; clientType: ClientType; status: ClientStatus; assignedTo: string;
    serviceIds: string[]; contractStart: string; contractEnd: string; retainer: string; retainerCurrency: Currency; notes: string;
  };
};

/** Returns null when the client doesn't exist or the user can't see it. */
export async function getClient(id: string, user: CurrentUser): Promise<ClientDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const c = await Client.findOne({ _id: id, deletedAt: null }).lean();
  if (!c || !canSeeAssigned(user, "clients.view_all", c.assignedTo)) return null;

  const [services, names, lead] = await Promise.all([
    Service.find({ _id: { $in: c.serviceIds ?? [] } }, { name: 1 }).lean(),
    namesFor([c.assignedTo, c.createdBy]),
    c.sourceLeadId ? Lead.findById(c.sourceLeadId, { fullName: 1, source: 1, convertedAt: 1 }).lean() : null,
  ]);
  const start = toDayString(c.contractStart);
  const end = toDayString(c.contractEnd);
  const currency = (c.monthlyRetainer?.currency ?? "LKR") as Currency;

  return {
    id: String(c._id),
    clientName: c.clientName,
    companyName: c.companyName ?? "",
    contactPerson: c.contactPerson ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    whatsapp: c.whatsapp ?? "",
    address: c.address ?? "",
    country: c.country ?? "",
    industry: c.industry ?? "",
    clientType: c.clientType as ClientType,
    status: c.status as ClientStatus,
    assignedTo: c.assignedTo ? String(c.assignedTo) : "",
    assignedName: c.assignedTo ? names.get(String(c.assignedTo)) ?? "Unknown" : null,
    services: services.map((s) => ({ id: String(s._id), name: s.name })),
    contractStart: c.contractStart ? c.contractStart.toISOString() : null,
    contractEnd: c.contractEnd ? c.contractEnd.toISOString() : null,
    retainerMinor: c.monthlyRetainer?.amount ?? null,
    retainerCurrency: currency,
    notes: c.notes ?? "",
    sourceLead: lead ? { id: String(lead._id), fullName: lead.fullName, source: lead.source as string, convertedAt: lead.convertedAt?.toISOString() ?? null } : null,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    createdAt: (c.createdAt as Date).toISOString(),
    createdByName: c.createdBy ? names.get(String(c.createdBy)) ?? null : null,
    form: {
      id: String(c._id), clientName: c.clientName, companyName: c.companyName ?? "", contactPerson: c.contactPerson ?? "",
      email: c.email ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", address: c.address ?? "", country: c.country ?? "",
      industry: c.industry ?? "", clientType: c.clientType as ClientType, status: c.status as ClientStatus,
      assignedTo: c.assignedTo ? String(c.assignedTo) : "", serviceIds: (c.serviceIds ?? []).map(String),
      contractStart: start, contractEnd: end, retainer: minorToAmount(c.monthlyRetainer?.amount), retainerCurrency: currency, notes: c.notes ?? "",
    },
  };
}

export type TimelineEntry = TimelineItem & { fromLead?: boolean };

/** Client activity merged with the history of the lead it was converted from. */
export async function getClientTimeline(clientId: string, sourceLeadId: string | null): Promise<TimelineEntry[]> {
  await connectDB();
  const [own, leadItems] = await Promise.all([
    ClientActivity.find({ clientId }).sort({ occurredAt: -1 }).limit(200).lean(),
    sourceLeadId ? getLeadActivityItems(sourceLeadId, 200) : [],
  ]);
  const names = await namesFor(own.map((a) => a.userId));
  const entries: TimelineEntry[] = [
    ...own.map((a) => ({
      id: String(a._id), kind: a.type as string, at: (a.occurredAt as Date).toISOString(),
      userName: a.userId ? names.get(String(a.userId)) ?? null : null, body: a.body ?? "",
      detail: (a.meta as { detail?: string } | null)?.detail,
    })),
    ...leadItems.map((i) => ({ ...i, fromLead: true })),
  ];
  return entries.sort((x, y) => y.at.localeCompare(x.at));
}

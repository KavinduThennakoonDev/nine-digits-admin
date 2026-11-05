"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { withTransaction } from "@/server/db/transaction";
import { Lead } from "@/server/db/models/lead";
import { LeadActivity } from "@/server/db/models/lead-activity";
import { Client } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import { canSeeAssigned } from "@/server/auth/scope";
import { audit, diff } from "@/server/services/audit";
import { notify, usersWith } from "@/server/services/notify";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull, instantToDate } from "@/lib/fields";
import { formatDateTime } from "@/lib/format";
import { CONVERTED_STATUS, NEW_STATUS, statusLabel as labelFor, type LeadStatusDef } from "@/lib/lead-statuses";
import { getLeadStatuses } from "@/server/services/lead-statuses";
import type { ActionResult } from "@/lib/action-result";
import {
  convertLeadSchema, leadSchema, logActivitySchema,
  type ConvertLeadInput, type LeadInput, type LogActivityInput,
} from "./schemas";

/** A status someone may pick by hand: configured, and not "converted" (only conversion sets that). */
function assertPickable(statuses: LeadStatusDef[], status: string) {
  if (status === CONVERTED_STATUS) throw new AppError("VALIDATION", "Use “Convert to client” to convert a lead.", { status: ["Pick another status."] });
  if (!statuses.some((s) => s.key === status)) throw new AppError("VALIDATION", "That status no longer exists.", { status: ["Pick another status."] });
}

async function loadVisibleLead(id: string, user: CurrentUser) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND", "Lead not found.");
  const lead = await Lead.findOne({ _id: id, deletedAt: null });
  if (!lead || !canSeeAssigned(user, "leads.view_all", lead.assignedTo)) throw new AppError("NOT_FOUND", "Lead not found.");
  return lead;
}

async function assertAssignee(id: string) {
  if (id && !(await User.exists({ _id: id, status: "active" }))) {
    throw new AppError("VALIDATION", "That team member is no longer active.", { assignedTo: ["Pick an active team member."] });
  }
}
async function assertService(id: string) {
  if (id && !(await Service.exists({ _id: id }))) {
    throw new AppError("VALIDATION", "That service no longer exists.", { interestedServiceId: ["Pick another service."] });
  }
}

/** Who a lead ends up assigned to, given the actor's permissions. */
function resolveAssignee(actor: CurrentUser, requested: string, current: string | null): string | null {
  if (can(actor, "leads.assign")) return requested || (can(actor, "leads.view_all") ? null : actor.id);
  return current ?? actor.id; // can't (re)assign: keep current, or self on create
}

export async function saveLeadAction(input: LeadInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const isCreate = !input.id;
    const actor = await authorize(isCreate ? "leads.create" : "leads.update");
    const data = parse(leadSchema, input);
    await connectDB();
    await assertService(data.interestedServiceId);

    const fields = {
      fullName: data.fullName, email: data.email, phone: data.phone, whatsapp: data.whatsapp, country: data.country,
      company: data.company, interestedServiceId: idOrNull(data.interestedServiceId), source: data.source,
      leadDate: dayToDate(data.leadDate)!, nextFollowUpAt: instantToDate(data.nextFollowUpAt), notes: data.notes,
    };

    const statuses = await getLeadStatuses();
    const statusLabel = (s: string) => labelFor(statuses, s);
    if (isCreate) {
      assertPickable(statuses, data.status);
      const assignedTo = resolveAssignee(actor, data.assignedTo, null);
      if (assignedTo) await assertAssignee(assignedTo);
      const lead = await Lead.create({ ...fields, status: data.status, assignedTo, createdBy: actor.id, updatedBy: actor.id });
      const acts: object[] = [{ leadId: lead._id, type: "system", userId: actor.id, notes: "", meta: { detail: "Lead created" } }];
      if (fields.nextFollowUpAt) acts.push({ leadId: lead._id, type: "system", userId: actor.id, meta: { detail: `Follow-up set for ${formatDateTime(fields.nextFollowUpAt)}` } });
      await LeadActivity.insertMany(acts);
      await audit({ userId: actor.id, action: "create", module: "leads", recordId: String(lead._id), summary: `Created lead ${data.fullName}`, after: { fullName: data.fullName, source: data.source } });
      await notify({
        type: "lead_new", actorId: actor.id, userIds: assignedTo ? [assignedTo] : await usersWith("leads.assign"),
        title: `New lead: ${data.fullName}`, body: [data.company, data.country].filter(Boolean).join(" · "), link: `/leads/${lead._id}`,
      });
      refresh();
      return { id: String(lead._id) };
    }

    const lead = await loadVisibleLead(data.id!, actor);
    const currentAssignee = lead.assignedTo ? String(lead.assignedTo) : null;
    const assignedTo = resolveAssignee(actor, data.assignedTo, currentAssignee);
    if (assignedTo !== currentAssignee && assignedTo) await assertAssignee(assignedTo);

    // Status: converted leads stay converted; nobody can jump to "converted" from the form.
    let status = data.status;
    if (lead.status === CONVERTED_STATUS) status = CONVERTED_STATUS;
    else if (status !== lead.status) assertPickable(statuses, status);

    const before = {
      ...Object.fromEntries(Object.keys(fields).map((k) => [k, String((lead as unknown as Record<string, unknown>)[k] ?? "")])),
      status: lead.status, assignedTo: currentAssignee,
    };
    const prevStatus = lead.status;
    const prevFollowUp = lead.nextFollowUpAt?.getTime() ?? null;

    lead.set({ ...fields, status, assignedTo, updatedBy: actor.id });
    await lead.save();

    const after = { ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? "")])), status, assignedTo };
    const d = diff(before, after);
    const acts: object[] = [];
    if (prevStatus !== status) acts.push({ leadId: lead._id, type: "status_change", userId: actor.id, meta: { detail: `${statusLabel(prevStatus)} → ${statusLabel(status)}`, from: prevStatus, to: status } });
    if (currentAssignee !== assignedTo) {
      const name = assignedTo ? (await User.findById(assignedTo, { name: 1 }).lean())?.name ?? "someone" : null;
      acts.push({ leadId: lead._id, type: "assignment", userId: actor.id, meta: { detail: name ? `Assigned to ${name}` : "Unassigned" } });
      if (assignedTo) {
        await notify({ type: "lead_assigned", actorId: actor.id, userIds: [assignedTo], title: `Lead assigned to you: ${data.fullName}`, link: `/leads/${lead._id}` });
      }
    }
    if ((fields.nextFollowUpAt?.getTime() ?? null) !== prevFollowUp) {
      acts.push({ leadId: lead._id, type: "system", userId: actor.id, meta: { detail: fields.nextFollowUpAt ? `Follow-up set for ${formatDateTime(fields.nextFollowUpAt)}` : "Follow-up cleared" } });
    }
    if (acts.length) await LeadActivity.insertMany(acts);
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "leads", recordId: data.id, summary: `Updated lead ${data.fullName}`, before: d.before, after: d.after });
    refresh();
    return { id: data.id! };
  });
}

const CONTACT_TYPES = new Set(["call", "whatsapp", "email", "meeting"]);

export async function logLeadActivityAction(input: LogActivityInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("leads.update");
    const data = parse(logActivitySchema, input);
    await connectDB();
    const lead = await loadVisibleLead(data.leadId, actor);

    const occurredAt = instantToDate(data.occurredAt) ?? new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      throw new AppError("VALIDATION", "Activities can't be logged in the future. Schedule a follow-up instead.", { occurredAt: ["Pick a time in the past."] });
    }
    const followUpAt = data.followUp === "set" ? instantToDate(data.nextFollowUpAt) : null;
    const reachedThem = CONTACT_TYPES.has(data.type) && (data.type !== "call" || data.outcome === "answered" || data.outcome === "callback_requested");

    const acts: object[] = [{
      leadId: lead._id, type: data.type, occurredAt, outcome: data.outcome || null,
      durationMin: data.durationMin ? Number(data.durationMin) : null, notes: data.notes, followUpAt, userId: actor.id,
    }];

    // Status: explicit choice wins; otherwise the first real contact moves a fresh lead to "Contacted".
    const statuses = await getLeadStatuses();
    const statusLabel = (s: string) => labelFor(statuses, s);
    let nextStatus = data.newStatus || null;
    if (nextStatus) assertPickable(statuses, nextStatus);
    if (!nextStatus && reachedThem && (lead.status === NEW_STATUS || lead.status === "not_contacted") && statuses.some((s) => s.key === "contacted")) nextStatus = "contacted";
    if (nextStatus && lead.status !== CONVERTED_STATUS && nextStatus !== lead.status) {
      acts.push({ leadId: lead._id, type: "status_change", occurredAt, userId: actor.id, meta: { detail: `${statusLabel(lead.status)} → ${statusLabel(nextStatus)}`, from: lead.status, to: nextStatus } });
      lead.status = nextStatus;
    }
    if (CONTACT_TYPES.has(data.type) && (!lead.lastContactedAt || occurredAt > lead.lastContactedAt)) lead.lastContactedAt = occurredAt;
    if (data.followUp === "set") lead.nextFollowUpAt = followUpAt;
    if (data.followUp === "clear") lead.nextFollowUpAt = null;
    lead.updatedBy = new Types.ObjectId(actor.id);

    await lead.save();
    await LeadActivity.insertMany(acts);
    refresh();
    return null;
  });
}

export async function setLeadStatusAction(id: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("leads.update");
    await connectDB();
    const statuses = await getLeadStatuses();
    assertPickable(statuses, status);
    const statusLabel = (s: string) => labelFor(statuses, s);
    const lead = await loadVisibleLead(id, actor);
    if (lead.status === CONVERTED_STATUS) throw new AppError("VALIDATION", "This lead has already been converted.");
    if (lead.status === status) return null;
    const from = lead.status;
    lead.status = status;
    lead.updatedBy = new Types.ObjectId(actor.id);
    await lead.save();
    await LeadActivity.create({ leadId: lead._id, type: "status_change", userId: actor.id, meta: { detail: `${statusLabel(from)} → ${statusLabel(status)}`, from, to: status } });
    await audit({ userId: actor.id, action: "update", module: "leads", recordId: id, summary: `Moved lead ${lead.fullName} to ${statusLabel(status)}`, before: { status: from }, after: { status } });
    refresh();
    return null;
  });
}

export async function setLeadArchivedAction(id: string, archived: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("leads.delete");
    await connectDB();
    const lead = await loadVisibleLead(id, actor);
    if (!!lead.archivedAt === archived) return null;
    lead.archivedAt = archived ? new Date() : null;
    lead.updatedBy = new Types.ObjectId(actor.id);
    await lead.save();
    await LeadActivity.create({ leadId: lead._id, type: "system", userId: actor.id, meta: { detail: archived ? "Lead archived" : "Lead restored" } });
    await audit({ userId: actor.id, action: archived ? "archive" : "restore", module: "leads", recordId: id, summary: `${archived ? "Archived" : "Restored"} lead ${lead.fullName}` });
    refresh();
    return null;
  });
}

export async function deleteLeadAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("leads.delete");
    await connectDB();
    const lead = await loadVisibleLead(id, actor);
    if (lead.status === "converted") throw new AppError("VALIDATION", "Converted leads hold a client's history and can only be archived.");
    lead.deletedAt = new Date();
    lead.updatedBy = new Types.ObjectId(actor.id);
    await lead.save();
    await audit({ userId: actor.id, action: "delete", module: "leads", recordId: id, summary: `Deleted lead ${lead.fullName}`, before: { fullName: lead.fullName } });
    return null;
  });
  if (!result.ok) return result;
  redirect("/leads");
}

/**
 * Creates a client from the lead in one transaction. The lead keeps all of its
 * history and links to the new client; the client links back via sourceLeadId.
 */
export async function convertLeadAction(input: ConvertLeadInput): Promise<ActionResult<{ clientId: string }>> {
  return runAction(async () => {
    const actor = await authorize("leads.convert", "clients.create");
    const data = parse(convertLeadSchema, input);
    await connectDB();
    const lead = await loadVisibleLead(data.leadId, actor);
    if (lead.status === "converted" || lead.convertedClientId) throw new AppError("CONFLICT", "This lead has already been converted.");

    let assignedTo = data.assignedTo || (lead.assignedTo ? String(lead.assignedTo) : "");
    if (!can(actor, "clients.view_all")) assignedTo = actor.id;
    if (assignedTo) await assertAssignee(assignedTo);
    const serviceIds = [...new Set(data.serviceIds)];
    if (serviceIds.length && (await Service.countDocuments({ _id: { $in: serviceIds } })) !== serviceIds.length) {
      throw new AppError("VALIDATION", "One of the selected services no longer exists.", { serviceIds: ["Remove services that no longer exist."] });
    }

    const statuses = await getLeadStatuses();
    const clientId = await withTransaction(async (session) => {
      const now = new Date();
      const [client] = await Client.create([{
        clientName: data.clientName, companyName: data.companyName || lead.company, contactPerson: lead.fullName,
        email: lead.email, phone: lead.phone, whatsapp: lead.whatsapp, country: lead.country,
        clientType: data.clientType, status: data.status, assignedTo: idOrNull(assignedTo), serviceIds,
        contractStart: dayToDate(data.contractStart),
        monthlyRetainer: { amount: amountToMinor(data.retainer), currency: data.retainerCurrency },
        notes: lead.notes, sourceLeadId: lead._id, createdBy: actor.id, updatedBy: actor.id,
      }], { session });

      const from = lead.status;
      lead.set({ status: "converted", convertedClientId: client._id, convertedAt: now, nextFollowUpAt: null, updatedBy: actor.id });
      await lead.save({ session });
      await LeadActivity.create([{
        leadId: lead._id, type: "conversion", userId: actor.id, occurredAt: now,
        meta: { detail: `${labelFor(statuses, from)} → ${labelFor(statuses, CONVERTED_STATUS)} · client “${data.clientName}”`, clientId: String(client._id) },
      }], { session });
      await ClientActivity.create([{ clientId: client._id, type: "system", userId: actor.id, occurredAt: now, body: `Converted from lead ${lead.fullName}` }], { session });
      return String(client._id);
    });

    await audit({ userId: actor.id, action: "convert", module: "leads", recordId: data.leadId, summary: `Converted lead ${lead.fullName} to client ${data.clientName}`, after: { clientId } });
    refresh();
    return { clientId };
  });
}

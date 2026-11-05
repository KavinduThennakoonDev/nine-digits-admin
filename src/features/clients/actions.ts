"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Client } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import { canSeeAssigned } from "@/server/auth/scope";
import { audit, diff } from "@/server/services/audit";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull, instantToDate } from "@/lib/fields";
import { CLIENT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import type { ActionResult } from "@/lib/action-result";
import { clientActivitySchema, clientSchema, type ClientActivityInput, type ClientInput } from "./schemas";

async function loadVisibleClient(id: string, user: CurrentUser) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND", "Client not found.");
  const client = await Client.findOne({ _id: id, deletedAt: null });
  if (!client || !canSeeAssigned(user, "clients.view_all", client.assignedTo)) throw new AppError("NOT_FOUND", "Client not found.");
  return client;
}

async function assertRefs(assignedTo: string, serviceIds: string[]) {
  if (assignedTo && !(await User.exists({ _id: assignedTo, status: "active" }))) {
    throw new AppError("VALIDATION", "That team member is no longer active.", { assignedTo: ["Pick an active team member."] });
  }
  if (serviceIds.length && (await Service.countDocuments({ _id: { $in: serviceIds } })) !== new Set(serviceIds).size) {
    throw new AppError("VALIDATION", "One of the selected services no longer exists.", { serviceIds: ["Remove services that no longer exist."] });
  }
}

type ClientLike = {
  clientName: string; companyName?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null;
  whatsapp?: string | null; address?: string | null; country?: string | null; industry?: string | null; clientType?: string | null;
  status?: string | null; assignedTo?: unknown; serviceIds?: unknown[] | null; contractStart?: Date | null; contractEnd?: Date | null;
  monthlyRetainer?: { amount?: number | null; currency?: string | null } | null; notes?: string | null;
};

/** Comparable, log-friendly view of a client (ids → strings, dates → ISO). */
function clientSnapshot(c: ClientLike) {
  return {
    clientName: c.clientName, companyName: c.companyName ?? "", contactPerson: c.contactPerson ?? "", email: c.email ?? "",
    phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", address: c.address ?? "", country: c.country ?? "", industry: c.industry ?? "",
    clientType: c.clientType, status: c.status, assignedTo: c.assignedTo ? String(c.assignedTo) : null,
    serviceIds: (c.serviceIds ?? []).map(String).sort(),
    contractStart: c.contractStart?.toISOString() ?? null, contractEnd: c.contractEnd?.toISOString() ?? null,
    retainer: c.monthlyRetainer?.amount == null ? null : `${c.monthlyRetainer.amount / 100} ${c.monthlyRetainer.currency}`,
    notes: c.notes ?? "",
  };
}

export async function saveClientAction(input: ClientInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const isCreate = !input.id;
    const actor = await authorize(isCreate ? "clients.create" : "clients.update");
    const data = parse(clientSchema, input);
    await connectDB();

    // Without "view all", a person must stay the assignee or they'd lose access to the record.
    let assignedTo = data.assignedTo;
    if (!can(actor, "clients.view_all")) assignedTo = actor.id;
    const serviceIds = [...new Set(data.serviceIds)];
    await assertRefs(assignedTo, serviceIds);

    const doc = {
      clientName: data.clientName, companyName: data.companyName, contactPerson: data.contactPerson, email: data.email,
      phone: data.phone, whatsapp: data.whatsapp, address: data.address, country: data.country, industry: data.industry,
      clientType: data.clientType, status: data.status, assignedTo: idOrNull(assignedTo), serviceIds,
      contractStart: dayToDate(data.contractStart), contractEnd: dayToDate(data.contractEnd),
      monthlyRetainer: { amount: amountToMinor(data.retainer), currency: data.retainerCurrency },
      notes: data.notes, updatedBy: actor.id,
    };

    if (isCreate) {
      const client = await Client.create({ ...doc, createdBy: actor.id });
      await ClientActivity.create({ clientId: client._id, type: "system", body: "Client created", userId: actor.id });
      await audit({ userId: actor.id, action: "create", module: "clients", recordId: String(client._id), summary: `Created client ${data.clientName}`, after: { clientName: data.clientName, status: data.status } });
      refresh();
      return { id: String(client._id) };
    }

    const client = await loadVisibleClient(data.id!, actor);
    const before = clientSnapshot(client);
    const statusChanged = client.status !== data.status;
    const previousStatus = client.status;

    client.set(doc);
    await client.save();

    const d = diff(before, clientSnapshot(doc));
    if (d.changed) {
      await audit({ userId: actor.id, action: "update", module: "clients", recordId: data.id, summary: `Updated client ${data.clientName}`, before: d.before, after: d.after });
    }
    if (statusChanged) {
      await ClientActivity.create({
        clientId: client._id, type: "status_change", userId: actor.id, body: "",
        meta: { detail: `${labelOf(CLIENT_STATUS_OPTIONS, previousStatus)} → ${labelOf(CLIENT_STATUS_OPTIONS, data.status)}` },
      });
    }
    refresh();
    return { id: data.id! };
  });
}

export async function setClientArchivedAction(id: string, archived: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("clients.archive");
    await connectDB();
    const client = await loadVisibleClient(id, actor);
    if (!!client.archivedAt === archived) return null;
    client.archivedAt = archived ? new Date() : null;
    client.updatedBy = new Types.ObjectId(actor.id);
    await client.save();
    await ClientActivity.create({ clientId: client._id, type: "system", userId: actor.id, body: archived ? "Client archived" : "Client restored" });
    await audit({ userId: actor.id, action: archived ? "archive" : "restore", module: "clients", recordId: id, summary: `${archived ? "Archived" : "Restored"} client ${client.clientName}` });
    refresh();
    return null;
  });
}

/** Soft delete: the record disappears from the app but stays in the database for history. */
export async function deleteClientAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("clients.delete");
    await connectDB();
    const client = await loadVisibleClient(id, actor);
    client.deletedAt = new Date();
    client.updatedBy = new Types.ObjectId(actor.id);
    await client.save();
    await audit({ userId: actor.id, action: "delete", module: "clients", recordId: id, summary: `Deleted client ${client.clientName}`, before: { clientName: client.clientName } });
    return null;
  });
  if (!result.ok) return result;
  redirect("/clients");
}

export async function addClientActivityAction(input: ClientActivityInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("clients.update");
    const data = parse(clientActivitySchema, input);
    await connectDB();
    const client = await loadVisibleClient(data.clientId, actor);
    await ClientActivity.create({
      clientId: client._id, type: data.type, body: data.body, userId: actor.id,
      occurredAt: instantToDate(data.occurredAt) ?? new Date(),
    });
    refresh();
    return null;
  });
}

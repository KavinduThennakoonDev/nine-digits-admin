"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Project } from "@/server/db/models/project";
import { Client } from "@/server/db/models/client";
import { ClientActivity } from "@/server/db/models/client-activity";
import { Service } from "@/server/db/models/service";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { assertActiveUsers, canSeeProject, logWork, userNameMap } from "@/server/services/work";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor, dayToDate, idOrNull } from "@/lib/fields";
import { labelOf, PROJECT_STATUS_OPTIONS } from "@/lib/constants";
import type { ActionResult } from "@/lib/action-result";
import { projectNoteSchema, projectSchema, type ProjectInput, type ProjectNoteInput } from "./schemas";

async function loadProject(id: string, user: CurrentUser) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND", "Project not found.");
  const p = await Project.findOne({ _id: id, deletedAt: null });
  if (!p || !canSeeProject(user, p)) throw new AppError("NOT_FOUND", "Project not found.");
  return p;
}

export async function saveProjectAction(input: ProjectInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("projects.manage");
    const data = parse(projectSchema, input);
    await connectDB();
    if (data.clientId && !(await Client.exists({ _id: data.clientId, deletedAt: null }))) {
      throw new AppError("VALIDATION", "That client no longer exists.", { clientId: ["Pick another client."] });
    }
    const serviceIds = [...new Set(data.serviceIds)];
    if (serviceIds.length && (await Service.countDocuments({ _id: { $in: serviceIds } })) !== serviceIds.length) {
      throw new AppError("VALIDATION", "A selected service no longer exists.", { serviceIds: ["Remove it."] });
    }
    const memberIds = [...new Set(data.memberIds)];
    await assertActiveUsers([...memberIds, ...(data.managerId ? [data.managerId] : [])], "memberIds");

    const fields = {
      name: data.name, clientId: idOrNull(data.clientId), serviceIds, managerId: idOrNull(data.managerId), memberIds,
      budget: { amount: amountToMinor(data.budget), currency: data.budgetCurrency },
      startDate: dayToDate(data.startDate), deadline: dayToDate(data.deadline),
      status: data.status, priority: data.priority, description: data.description, updatedBy: actor.id,
    };

    if (!data.id) {
      const project = await Project.create({ ...fields, completedAt: data.status === "completed" ? new Date() : null, createdBy: actor.id });
      await logWork("project", project._id, actor.id, "system", "Project created");
      if (fields.clientId) {
        await ClientActivity.create({ clientId: fields.clientId, type: "system", userId: actor.id, body: "", meta: { detail: `Project “${data.name}” created` } });
      }
      await audit({ userId: actor.id, action: "create", module: "projects", recordId: String(project._id), summary: `Created project “${data.name}”` });
      refresh();
      return { id: String(project._id) };
    }

    const project = await loadProject(data.id, actor);
    const prevStatus = project.status;
    const prevMembers = new Set(project.memberIds.map(String));
    project.set(fields);
    if (prevStatus !== data.status) project.completedAt = data.status === "completed" ? new Date() : null;
    await project.save();

    if (prevStatus !== data.status) {
      await logWork("project", project._id, actor.id, "status_change", `${labelOf(PROJECT_STATUS_OPTIONS, prevStatus)} → ${labelOf(PROJECT_STATUS_OPTIONS, data.status)}`);
    }
    const added = memberIds.filter((m) => !prevMembers.has(m));
    const removed = [...prevMembers].filter((m) => !memberIds.includes(m));
    if (added.length || removed.length) {
      const names = await userNameMap([...added, ...removed]);
      const parts = [
        added.length ? `Added ${added.map((a) => names.get(a)).join(", ")}` : "",
        removed.length ? `Removed ${removed.map((r) => names.get(r)).join(", ")}` : "",
      ].filter(Boolean);
      await logWork("project", project._id, actor.id, "assignment", parts.join(" · "));
    }
    await audit({ userId: actor.id, action: "update", module: "projects", recordId: data.id, summary: `Updated project “${data.name}”` });
    refresh();
    return { id: data.id };
  });
}

/** Managers and team members can add notes to the project history. */
export async function addProjectNoteAction(input: ProjectNoteInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("projects.view");
    const data = parse(projectNoteSchema, input);
    await connectDB();
    const project = await loadProject(data.projectId, actor);
    await logWork("project", project._id, actor.id, "note", "", data.body);
    refresh();
    return null;
  });
}

export async function deleteProjectAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("projects.manage");
    await connectDB();
    const project = await loadProject(id, actor);
    if (!can(actor, "projects.view_all") && String(project.createdBy) !== actor.id && String(project.managerId) !== actor.id) {
      throw new AppError("FORBIDDEN", "Only the project's manager can delete it.");
    }
    project.set({ deletedAt: new Date(), updatedBy: actor.id });
    await project.save();
    await audit({ userId: actor.id, action: "delete", module: "projects", recordId: id, summary: `Deleted project “${project.name}” (tasks and expenses keep their records)` });
    return null;
  });
  if (!result.ok) return result;
  redirect("/projects");
}

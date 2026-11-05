"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Task } from "@/server/db/models/task";
import { TaskComment } from "@/server/db/models/task-comment";
import { Project } from "@/server/db/models/project";
import { Client } from "@/server/db/models/client";
import { authorize, can, type CurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notify";
import { assertActiveUsers, canSeeTask, logWork, userNameMap } from "@/server/services/work";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { dayToDate, idOrNull } from "@/lib/fields";
import { formatDay } from "@/lib/format";
import { labelOf, TASK_STATUSES, TASK_STATUS_OPTIONS, type TaskStatus } from "@/lib/constants";
import type { ActionResult } from "@/lib/action-result";
import { commentSchema, taskSchema, type CommentInput, type TaskInput } from "./schemas";

async function loadTask(id: string, user: CurrentUser) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND", "Task not found.");
  const t = await Task.findOne({ _id: id, deletedAt: null });
  if (!t || !canSeeTask(user, t)) throw new AppError("NOT_FOUND", "Task not found.");
  return t;
}

const statusLabel = (s: string) => labelOf(TASK_STATUS_OPTIONS, s);

export async function saveTaskAction(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("tasks.manage");
    const data = parse(taskSchema, input);
    await connectDB();
    let clientId = data.clientId;
    if (data.projectId) {
      const project = await Project.findOne({ _id: data.projectId, deletedAt: null }, { clientId: 1 }).lean();
      if (!project) throw new AppError("VALIDATION", "That project no longer exists.", { projectId: ["Pick another project."] });
      // A task inside a project belongs to the project's client.
      if (!clientId && project.clientId) clientId = String(project.clientId);
    }
    if (clientId && !(await Client.exists({ _id: clientId, deletedAt: null }))) {
      throw new AppError("VALIDATION", "That client no longer exists.", { clientId: ["Pick another client."] });
    }
    const assigneeIds = [...new Set(data.assigneeIds)];
    await assertActiveUsers(assigneeIds, "assigneeIds");
    const fields = {
      title: data.title, description: data.description, projectId: idOrNull(data.projectId), clientId: idOrNull(clientId),
      assigneeIds, dueDate: dayToDate(data.dueDate), priority: data.priority, status: data.status, updatedBy: actor.id,
    };

    if (!data.id) {
      const task = await Task.create({ ...fields, completedAt: data.status === "done" ? new Date() : null, createdBy: actor.id });
      await logWork("task", task._id, actor.id, "system", "Task created");
      if (assigneeIds.length) {
        const names = await userNameMap(assigneeIds);
        await logWork("task", task._id, actor.id, "assignment", `Assigned to ${assigneeIds.map((a) => names.get(a)).join(", ")}`);
      }
      if (fields.projectId) await logWork("project", fields.projectId, actor.id, "system", `Task “${data.title}” added`);
      await audit({ userId: actor.id, action: "create", module: "tasks", recordId: String(task._id), summary: `Created task “${data.title}”` });
      await notify({ type: "task_assigned", actorId: actor.id, userIds: assigneeIds, title: `New task: ${data.title}`,
        body: fields.dueDate ? `Due ${formatDay(fields.dueDate)}` : "", link: `/tasks/${task._id}` });
      refresh();
      return { id: String(task._id) };
    }

    const task = await loadTask(data.id, actor);
    const prev = { status: task.status, assignees: task.assigneeIds.map(String), due: task.dueDate?.getTime() ?? null };
    task.set(fields);
    if (prev.status !== data.status) task.completedAt = data.status === "done" ? new Date() : null;
    await task.save();

    if (prev.status !== data.status) await logWork("task", task._id, actor.id, "status_change", `${statusLabel(prev.status)} → ${statusLabel(data.status)}`);
    const added = assigneeIds.filter((a) => !prev.assignees.includes(a));
    const removed = prev.assignees.filter((a) => !assigneeIds.includes(a));
    if (added.length) {
      await notify({ type: "task_assigned", actorId: actor.id, userIds: added, title: `Task assigned to you: ${data.title}`,
        body: fields.dueDate ? `Due ${formatDay(fields.dueDate)}` : "", link: `/tasks/${task._id}` });
    }
    if (added.length || removed.length) {
      const names = await userNameMap([...added, ...removed]);
      await logWork("task", task._id, actor.id, "assignment", [
        added.length ? `Assigned ${added.map((a) => names.get(a)).join(", ")}` : "",
        removed.length ? `Unassigned ${removed.map((r) => names.get(r)).join(", ")}` : "",
      ].filter(Boolean).join(" · "));
    }
    if (prev.status !== data.status || added.length || removed.length) {
      await audit({ userId: actor.id, action: "update", module: "tasks", recordId: data.id, summary: `Updated task “${data.title}”` });
    }
    if ((fields.dueDate?.getTime() ?? null) !== prev.due) {
      await logWork("task", task._id, actor.id, "system", fields.dueDate ? `Due date set to ${formatDay(fields.dueDate)}` : "Due date removed");
    }
    refresh();
    return { id: data.id };
  });
}

/** Assignees (and managers) can move a task through its statuses. */
export async function setTaskStatusAction(id: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tasks.view");
    if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new AppError("VALIDATION", "Unknown status.");
    await connectDB();
    const task = await loadTask(id, actor);
    const isAssignee = task.assigneeIds.some((a) => String(a) === actor.id);
    if (!can(actor, "tasks.manage") && !isAssignee) throw new AppError("FORBIDDEN", "Only assignees can update this task.");
    if (task.status === status) return null;
    const from = task.status;
    task.set({ status: status as TaskStatus, completedAt: status === "done" ? new Date() : null, updatedBy: actor.id });
    await task.save();
    await logWork("task", task._id, actor.id, "status_change", `${statusLabel(from)} → ${statusLabel(status)}`);
    await audit({ userId: actor.id, action: "update", module: "tasks", recordId: id, summary: `Moved “${task.title}” to ${statusLabel(status)}` });
    refresh();
    return null;
  });
}

export async function addCommentAction(input: CommentInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tasks.view");
    const data = parse(commentSchema, input);
    await connectDB();
    const task = await loadTask(data.taskId, actor);
    await TaskComment.create({ taskId: task._id, userId: actor.id, body: data.body });
    await Task.updateOne({ _id: task._id }, { $inc: { commentCount: 1 } });
    await audit({ userId: actor.id, action: "comment", module: "tasks", recordId: data.taskId, summary: `Commented on “${task.title}”` });
    refresh();
    return null;
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("tasks.view");
    await connectDB();
    const c = Types.ObjectId.isValid(commentId) ? await TaskComment.findOne({ _id: commentId, deletedAt: null }) : null;
    if (!c) throw new AppError("NOT_FOUND", "Comment not found.");
    if (String(c.userId) !== actor.id && !can(actor, "tasks.manage")) throw new AppError("FORBIDDEN", "You can only delete your own comments.");
    c.deletedAt = new Date();
    await c.save();
    await Task.updateOne({ _id: c.taskId }, { $inc: { commentCount: -1 } });
    refresh();
    return null;
  });
}

export async function deleteTaskAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const actor = await authorize("tasks.manage");
    await connectDB();
    const task = await loadTask(id, actor);
    task.set({ deletedAt: new Date(), updatedBy: actor.id });
    await task.save();
    await audit({ userId: actor.id, action: "delete", module: "tasks", recordId: id, summary: `Deleted task “${task.title}”` });
    return null;
  });
  if (!result.ok) return result;
  redirect("/tasks");
}

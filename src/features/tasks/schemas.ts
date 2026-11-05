import { z } from "zod";
import { objectId, optionalDay, optionalId, requiredText, text } from "@/lib/fields";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";

export const taskSchema = z.object({
  id: z.string().optional(),
  title: requiredText("a title", 200),
  description: text(5000),
  projectId: optionalId,
  clientId: optionalId,
  assigneeIds: z.array(objectId).max(20).default([]),
  dueDate: optionalDay,
  priority: z.enum(PRIORITIES),
  status: z.enum(TASK_STATUSES),
});
export type TaskInput = z.input<typeof taskSchema>;

export const commentSchema = z.object({ taskId: objectId, body: requiredText("a comment", 5000) });
export type CommentInput = z.input<typeof commentSchema>;

import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";

const taskSchema = new Schema(
  {
    ...auditFieldDefs,
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    assigneeIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    status: { type: String, enum: TASK_STATUSES, default: "todo" },
    /** Position within its status column on the board. */
    sortOrder: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    commentCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
taskSchema.index({ deletedAt: 1, status: 1, dueDate: 1 });
taskSchema.index({ assigneeIds: 1, status: 1, dueDate: 1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ createdBy: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema>;
export const Task = defineModel("Task", taskSchema);

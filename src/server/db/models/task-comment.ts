import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";

const taskCommentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 5000 },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
taskCommentSchema.index({ taskId: 1, createdAt: 1 });

export type TaskCommentDoc = InferSchemaType<typeof taskCommentSchema>;
export const TaskComment = defineModel("TaskComment", taskCommentSchema);

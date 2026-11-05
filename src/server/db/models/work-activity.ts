import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";

/** History entries for projects and tasks (status changes, assignments, notes). */
const workActivitySchema = new Schema(
  {
    entity: { type: String, enum: ["project", "task"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["note", "status_change", "assignment", "system"], required: true },
    body: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    meta: { type: Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
workActivitySchema.index({ entity: 1, entityId: 1, occurredAt: -1 });

export type WorkActivityDoc = InferSchemaType<typeof workActivitySchema>;
export const WorkActivity = defineModel("WorkActivity", workActivitySchema);

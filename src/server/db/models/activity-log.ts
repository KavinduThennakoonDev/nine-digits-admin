import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true }, // e.g. "create", "update", "delete", "login"
    module: { type: String, required: true }, // e.g. "users", "roles", "settings", "auth"
    recordId: { type: Schema.Types.ObjectId, default: null },
    summary: { type: String, default: "" },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
activityLogSchema.index({ module: 1, recordId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema>;
export const ActivityLog = defineModel("ActivityLog", activityLogSchema);

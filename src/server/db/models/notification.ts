import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";
import { NOTIFICATION_TYPES } from "@/lib/constants";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    readAt: { type: Date, default: null },
    /** Prevents the same reminder twice (e.g. "followup_due:<lead>:<due>:<user>"). */
    dedupeKey: { type: String, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
// Keep the collection small: notifications older than 90 days are removed.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export const Notification = defineModel("Notification", notificationSchema);

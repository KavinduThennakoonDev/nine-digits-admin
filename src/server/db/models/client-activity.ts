import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";
import { CLIENT_ACTIVITY_TYPES } from "@/lib/constants";

const clientActivitySchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    type: { type: String, enum: CLIENT_ACTIVITY_TYPES, required: true },
    occurredAt: { type: Date, default: Date.now },
    body: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);
clientActivitySchema.index({ clientId: 1, occurredAt: -1 });

export type ClientActivityDoc = InferSchemaType<typeof clientActivitySchema>;
export const ClientActivity = defineModel("ClientActivity", clientActivitySchema);

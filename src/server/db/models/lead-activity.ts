import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";
import { CALL_OUTCOMES, LEAD_ACTIVITY_TYPES } from "@/lib/constants";

/** Every call, message, note and status change on a lead — the lead's full history. */
const leadActivitySchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    type: { type: String, enum: LEAD_ACTIVITY_TYPES, required: true },
    occurredAt: { type: Date, default: Date.now },
    outcome: { type: String, enum: [...CALL_OUTCOMES, null], default: null },
    durationMin: { type: Number, default: null, min: 0 },
    notes: { type: String, default: "" },
    /** Follow-up scheduled as a result of this activity. */
    followUpAt: { type: Date, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);
leadActivitySchema.index({ leadId: 1, occurredAt: -1 });
leadActivitySchema.index({ userId: 1, occurredAt: -1 });

export type LeadActivityDoc = InferSchemaType<typeof leadActivitySchema>;
export const LeadActivity = defineModel("LeadActivity", leadActivitySchema);

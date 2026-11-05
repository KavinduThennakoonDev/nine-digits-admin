import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";

const leadSchema = new Schema(
  {
    ...auditFieldDefs,
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    interestedServiceId: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    source: { type: String, enum: LEAD_SOURCES, default: "other" },
    status: { type: String, enum: LEAD_STATUSES, default: "new" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    leadDate: { type: Date, default: Date.now },
    nextFollowUpAt: { type: Date, default: null },
    lastContactedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    convertedClientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    convertedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
leadSchema.index({ deletedAt: 1, archivedAt: 1, status: 1, leadDate: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ nextFollowUpAt: 1, status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ country: 1 });

export type LeadDoc = InferSchemaType<typeof leadSchema>;
export const Lead = defineModel("Lead", leadSchema);

import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CLIENT_STATUSES, CLIENT_TYPES, CURRENCIES } from "@/lib/constants";

const clientSchema = new Schema(
  {
    ...auditFieldDefs,
    clientName: { type: String, required: true, trim: true, maxlength: 160 },
    companyName: { type: String, trim: true, default: "" },
    contactPerson: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    industry: { type: String, trim: true, default: "" },
    clientType: { type: String, enum: CLIENT_TYPES, default: "retainer" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    serviceIds: { type: [{ type: Schema.Types.ObjectId, ref: "Service" }], default: [] },
    contractStart: { type: Date, default: null },
    contractEnd: { type: Date, default: null },
    /** Minor units; null when the client has no retainer. */
    monthlyRetainer: {
      amount: { type: Number, default: null, min: 0 },
      currency: { type: String, enum: CURRENCIES, default: "LKR" },
    },
    status: { type: String, enum: CLIENT_STATUSES, default: "onboarding" },
    notes: { type: String, default: "" },
    /** The lead this client was converted from (history stays on the lead). */
    sourceLeadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
clientSchema.index({ deletedAt: 1, archivedAt: 1, status: 1, createdAt: -1 });
clientSchema.index({ assignedTo: 1, status: 1 });
clientSchema.index({ country: 1 });
clientSchema.index({ sourceLeadId: 1 }, { sparse: true });

export type ClientDoc = InferSchemaType<typeof clientSchema>;
export const Client = defineModel("Client", clientSchema);

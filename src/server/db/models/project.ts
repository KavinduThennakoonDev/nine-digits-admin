import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES, PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

const projectSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    serviceIds: { type: [{ type: Schema.Types.ObjectId, ref: "Service" }], default: [] },
    /** Minor units; null = no budget set. */
    budget: {
      amount: { type: Number, default: null, min: 0 },
      currency: { type: String, enum: CURRENCIES, default: "LKR" },
    },
    startDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    memberIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    status: { type: String, enum: PROJECT_STATUSES, default: "planning" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    description: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
projectSchema.index({ deletedAt: 1, status: 1, deadline: 1 });
projectSchema.index({ clientId: 1 });
projectSchema.index({ memberIds: 1 });
projectSchema.index({ managerId: 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;
export const Project = defineModel("Project", projectSchema);

import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES, SERVICE_BILLING } from "@/lib/constants";

const serviceSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    billing: { type: String, enum: SERVICE_BILLING, default: "monthly" },
    /** Base price in minor units. */
    basePrice: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, enum: CURRENCIES, default: "LKR" },
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
serviceSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type ServiceDoc = InferSchemaType<typeof serviceSchema>;
export const Service = defineModel("Service", serviceSchema);

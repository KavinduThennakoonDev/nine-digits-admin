import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";

import { CURRENCIES } from "@/lib/constants";
export { CURRENCIES, type Currency } from "@/lib/constants";

/** Singleton document (key = "global"). */
const settingsSchema = new Schema(
  {
    ...auditFieldDefs,
    key: { type: String, default: "global", unique: true },
    agency: {
      name: { type: String, default: "Nine Digits" },
      legalName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      website: { type: String, default: "" },
      address: { type: String, default: "" },
      country: { type: String, default: "Sri Lanka" },
      taxId: { type: String, default: "" },
    },
    currency: {
      base: { type: String, enum: CURRENCIES, default: "LKR" },
      /** Manual rate: 1 USD = usdToLkr LKR. Snapshotted onto each financial record. */
      usdToLkr: { type: Number, default: 300, min: 0.0001 },
      rateHistory: {
        type: [{ usdToLkr: Number, changedAt: Date, changedBy: { type: Schema.Types.ObjectId, ref: "User" } }],
        default: [],
      },
    },
    invoice: {
      prefix: { type: String, default: "ND" },
      defaultDueDays: { type: Number, default: 14 },
    },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const Settings = defineModel("Settings", settingsSchema);

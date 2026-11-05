import { Schema } from "mongoose";
import { defineModel } from "../plugins";

/** Fixed-window counters (e.g. login attempts per IP). Expired windows are removed by MongoDB. */
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = defineModel("RateLimit", rateLimitSchema);

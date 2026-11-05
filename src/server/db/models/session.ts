import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** SHA-256 of the opaque cookie token — the raw token is never stored. */
    tokenHash: { type: String, required: true, unique: true },
    sessionVersion: { type: Number, required: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const Session = defineModel("Session", sessionSchema);

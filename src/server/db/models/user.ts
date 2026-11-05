import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";

import { USER_STATUSES } from "@/lib/constants";
export { USER_STATUSES, type UserStatus } from "@/lib/constants";

const userSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    /** Per-user overrides layered on top of the role's permissions. */
    permissionOverrides: {
      grant: { type: [String], default: [] },
      deny: { type: [String], default: [] },
    },
    status: { type: String, enum: USER_STATUSES, default: "active", index: true },
    phone: { type: String, trim: true, default: "" },
    jobTitle: { type: String, trim: true, default: "" },
    /** Bump to invalidate every session of this user (password reset, suspension). */
    sessionVersion: { type: Number, default: 0 },
    mustChangePassword: { type: Boolean, default: false },
    /** Notification types this person has turned off. */
    mutedNotifications: { type: [String], default: [] },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
userSchema.index({ name: "text", email: "text" });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = defineModel("User", userSchema);

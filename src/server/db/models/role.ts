import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";

const roleSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    /** System roles (Super Admin, Admin, Manager, Employee) cannot be deleted. */
    isSystem: { type: Boolean, default: false },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type RoleDoc = InferSchemaType<typeof roleSchema>;
export const Role = defineModel("Role", roleSchema);

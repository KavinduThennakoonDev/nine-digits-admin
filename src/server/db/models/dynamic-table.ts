import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";
import { CURRENCIES } from "@/lib/constants";
import { FIELD_TYPES, TABLE_ICONS } from "@/lib/dynamic/types";

const optionSchema = new Schema({ id: { type: String, required: true }, label: { type: String, required: true, trim: true } }, { _id: false });

/** Field metadata. `id` is immutable and is the key under which records store values. */
const fieldSchema = new Schema(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: FIELD_TYPES, required: true },
    placeholder: { type: String, default: "" },
    helpText: { type: String, default: "" },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    options: { type: [optionSchema], default: [] },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    currency: { type: String, enum: CURRENCIES, default: "LKR" },
    order: { type: Number, default: 0 },
    showInTable: { type: Boolean, default: true },
    showInForm: { type: Boolean, default: true },
    /** Archived fields keep their data in every record and can be restored. */
    archivedAt: { type: Date, default: null },
  },
  { _id: false },
);

const accessSchema = new Schema(
  { roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true }, level: { type: String, enum: ["none", "view", "edit"], required: true } },
  { _id: false },
);

const dynamicTableSchema = new Schema(
  {
    ...auditFieldDefs,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    icon: { type: String, enum: TABLE_ICONS, default: "table" },
    fields: { type: [fieldSchema], default: [] },
    /** Bumped on every structural change. */
    schemaVersion: { type: Number, default: 1 },
    /** Access for people with tables.view; per-role overrides below. */
    defaultLevel: { type: String, enum: ["none", "view", "edit"], default: "edit" },
    roleAccess: { type: [accessSchema], default: [] },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
dynamicTableSchema.index({ deletedAt: 1, archivedAt: 1, name: 1 });

export type DynamicTableDoc = InferSchemaType<typeof dynamicTableSchema>;
export const DynamicTable = defineModel("DynamicTable", dynamicTableSchema);

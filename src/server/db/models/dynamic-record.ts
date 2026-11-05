import { Schema, type InferSchemaType } from "mongoose";
import { auditFieldDefs, defineModel } from "../plugins";

/**
 * One row of a custom table. `data` is keyed by field id (not label/key), so
 * renaming fields never touches records. Values for archived fields stay here.
 */
const dynamicRecordSchema = new Schema(
  {
    ...auditFieldDefs,
    tableId: { type: Schema.Types.ObjectId, ref: "DynamicTable", required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    /** Values that couldn't be converted during a field type change: { [fieldId]: { value, fromType, at } }. */
    legacy: { type: Schema.Types.Mixed, default: null },
    /** Lower-cased display text of all active fields, for search. */
    searchText: { type: String, default: "" },
    schemaVersion: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
dynamicRecordSchema.index({ tableId: 1, deletedAt: 1, createdAt: -1 });
// Filtering/sorting on any custom field (MongoDB 7+ compound wildcard index).
dynamicRecordSchema.index({ tableId: 1, "data.$**": 1 });

export type DynamicRecordDoc = InferSchemaType<typeof dynamicRecordSchema>;
export const DynamicRecord = defineModel("DynamicRecord", dynamicRecordSchema);

import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "../plugins";

/** Atomic sequences, e.g. { _id: "invoice-2026", seq: 42 }. */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });

export type CounterDoc = InferSchemaType<typeof counterSchema>;
export const Counter = defineModel("Counter", counterSchema);

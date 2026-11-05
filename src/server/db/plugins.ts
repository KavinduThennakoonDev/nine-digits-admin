import { Schema, model, models } from "mongoose";

/** createdBy / updatedBy audit references — spread into schema definitions. */
export const auditFieldDefs = {
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
} as const;

/**
 * Registers a model once (safe across HMR / warm serverless instances) while
 * keeping Mongoose's full schema-inferred typing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineModel<TSchema extends Schema<any, any, any, any, any, any, any, any>>(name: string, schema: TSchema) {
  const create = () => model(name, schema);
  return (models[name] as ReturnType<typeof create> | undefined) ?? create();
}

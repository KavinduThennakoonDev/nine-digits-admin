import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { connectDB } from "./connect";

/** Runs `fn` in a MongoDB transaction (Atlas replica set), retrying transient errors. */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

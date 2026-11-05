import mongoose from "mongoose";
import { DB_NAME } from "./db-name";

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __mongoose?: Cached };
const cached: Cached = (globalForMongoose.__mongoose ??= { conn: null, promise: null });

/**
 * Reuses one Mongoose connection per server instance (survives HMR in dev
 * and warm serverless invocations on Vercel).
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");

  cached.promise ??= mongoose
    .connect(uri, {
      dbName: DB_NAME,
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    })
    .catch((err) => {
      cached.promise = null;
      throw err;
    });

  cached.conn = await cached.promise;
  return cached.conn;
}

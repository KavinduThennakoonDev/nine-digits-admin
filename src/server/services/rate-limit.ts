import "server-only";
import { connectDB } from "../db/connect";
import { RateLimit } from "../db/models/rate-limit";

/**
 * Counts one hit against `key` in a fixed window and reports whether it is over `limit`.
 * Backed by MongoDB so it holds across serverless instances.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<{ limited: boolean; retryAfterMs: number }> {
  await connectDB();
  const now = new Date();
  // Start a fresh window if the old one has lapsed (TTL cleanup can lag by a minute).
  await RateLimit.deleteOne({ key, expiresAt: { $lte: now } });
  try {
    const doc = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowMs) } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    return { limited: doc.count > limit, retryAfterMs: Math.max(0, doc.expiresAt.getTime() - now.getTime()) };
  } catch (err) {
    // Two first hits raced on the unique key; the other one created the window.
    if ((err as { code?: number }).code === 11000) return hit(key, limit, windowMs);
    throw err;
  }
}

export async function resetLimit(key: string) {
  await connectDB();
  await RateLimit.deleteOne({ key });
}

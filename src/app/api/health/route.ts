import { NextResponse } from "next/server";
import { connection } from "next/server";
import { connectDB } from "@/server/db/connect";

/** Uptime check: reports whether the app can reach the database. Reveals nothing else. */
export async function GET() {
  await connection();
  const started = Date.now();
  try {
    const conn = await connectDB();
    await conn.connection.db!.admin().ping();
    return NextResponse.json({ ok: true, db: "up", latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connectDB } from "../db/connect";
import { Session } from "../db/models/session";

export const SESSION_COOKIE = "nd_session";
const DAY_MS = 1000 * 60 * 60 * 24;
export const SESSION_TTL_MS = DAY_MS; // default: 1 day
export const REMEMBER_TTL_MS = DAY_MS * 30; // "Keep me signed in": 30 days

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

async function setCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Creates a DB-backed session and sets an opaque, httpOnly cookie. Server Actions only. */
export async function createSession(userId: string, sessionVersion: number, remember = false) {
  await connectDB();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS));
  const h = await headers();
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    sessionVersion,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? "",
    ip: clientIp(h),
    expiresAt,
  });
  await setCookie(token, expiresAt);
}

export async function destroyCurrentSession() {
  const token = await readSessionToken();
  if (token) {
    await connectDB();
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
}

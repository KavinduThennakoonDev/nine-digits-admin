import "server-only";
import { headers } from "next/headers";
import { ActivityLog } from "../db/models/activity-log";
import { clientIp } from "../auth/session";

type AuditInput = {
  userId: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/** Returns only the keys whose values changed, so logs stay small and readable. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

export async function audit(input: AuditInput) {
  let ip = "";
  try {
    ip = clientIp(await headers());
  } catch {
    // outside a request (seed scripts)
  }
  await ActivityLog.create({ ...input, recordId: input.recordId ?? null, ip });
}

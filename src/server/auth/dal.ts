import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { connectDB } from "../db/connect";
import { Session } from "../db/models/session";
import { User } from "../db/models/user";
import { Role } from "../db/models/role";
import { AppError } from "../errors";
import { hashToken, readSessionToken } from "./session";
import { resolvePermissions, SUPER_ADMIN_SLUG, type Permission } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  sessionId: string;
  sessionExpiresAt: Date;
  name: string;
  email: string;
  jobTitle: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  permissions: Permission[];
};

/**
 * Data Access Layer entry point. Reads the session cookie, validates it against
 * the DB, and returns a narrow user object. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  // Session validity depends on the current time, so this must never be prerendered.
  await connection();

  await connectDB();
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;

  const user = await User.findById(session.userId).lean();
  if (!user || user.status !== "active" || user.sessionVersion !== session.sessionVersion) return null;

  const role = await Role.findById(user.roleId).lean();
  if (!role) return null;

  return {
    id: String(user._id),
    sessionId: String(session._id),
    sessionExpiresAt: session.expiresAt,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle ?? "",
    roleId: String(role._id),
    roleName: role.name,
    roleSlug: role.slug,
    isSuperAdmin: role.slug === SUPER_ADMIN_SLUG,
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: resolvePermissions(role.slug, role.permissions, user.permissionOverrides ?? undefined),
  };
});

export function can(user: Pick<CurrentUser, "permissions">, ...perms: Permission[]): boolean {
  return perms.every((p) => user.permissions.includes(p));
}

export function canAny(user: Pick<CurrentUser, "permissions">, ...perms: Permission[]): boolean {
  return perms.some((p) => user.permissions.includes(p));
}

/** For pages/layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For Server Actions / services: throws AppError when unauthenticated or forbidden. */
export async function authorize(...perms: Permission[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  if (!can(user, ...perms)) throw new AppError("FORBIDDEN", "You don't have permission to do that.");
  return user;
}

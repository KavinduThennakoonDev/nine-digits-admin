"use server";

import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/db/models/user";
import { Role } from "@/server/db/models/role";
import { Session } from "@/server/db/models/session";
import { authorize } from "@/server/auth/dal";
import { hashPassword } from "@/server/auth/password";
import { audit, diff } from "@/server/services/audit";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { isPermission, SUPER_ADMIN_SLUG } from "@/lib/permissions";
import type { ActionResult } from "@/lib/action-result";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from "./schemas";

async function loadRole(roleId: string) {
  const role = await Role.findById(roleId).lean();
  if (!role) throw new AppError("VALIDATION", "Selected role no longer exists.", { roleId: ["Select a valid role."] });
  return role;
}

/** Only a Super Admin may create, edit or assign Super Admins. */
function assertCanTouchSuperAdmin(actorIsSuper: boolean, ...slugs: (string | undefined)[]) {
  if (!actorIsSuper && slugs.includes(SUPER_ADMIN_SLUG)) {
    throw new AppError("FORBIDDEN", "Only a Super Admin can manage Super Admin accounts.");
  }
}

async function activeSuperAdminCount() {
  const role = await Role.findOne({ slug: SUPER_ADMIN_SLUG }, { _id: 1 }).lean();
  return role ? User.countDocuments({ roleId: role._id, status: "active" }) : 0;
}

export async function createUserAction(input: CreateUserInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("users.manage");
    const data = parse(createUserSchema, input);
    await connectDB();
    const role = await loadRole(data.roleId);
    assertCanTouchSuperAdmin(actor.isSuperAdmin, role.slug);

    const user = await User.create({
      name: data.name,
      email: data.email,
      roleId: role._id,
      jobTitle: data.jobTitle,
      phone: data.phone,
      passwordHash: await hashPassword(data.password),
      mustChangePassword: true,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await audit({
      userId: actor.id, action: "create", module: "users", recordId: String(user._id),
      summary: `Created user ${data.name} (${role.name})`,
      after: { name: data.name, email: data.email, role: role.name },
    });
    refresh();
    return { id: String(user._id) };
  });
}

export async function updateUserAction(input: UpdateUserInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("users.manage");
    const data = parse(updateUserSchema, input);
    await connectDB();

    const user = await User.findById(data.id);
    if (!user) throw new AppError("NOT_FOUND", "User not found.");
    const [oldRole, newRole] = await Promise.all([Role.findById(user.roleId).lean(), loadRole(data.roleId)]);
    assertCanTouchSuperAdmin(actor.isSuperAdmin, oldRole?.slug, newRole.slug);

    const isSelf = actor.id === data.id;
    if (isSelf && data.status !== "active") throw new AppError("VALIDATION", "You can't deactivate your own account.");
    if (isSelf && String(user.roleId) !== String(newRole._id)) throw new AppError("VALIDATION", "You can't change your own role.");

    const losingSuperAdmin =
      oldRole?.slug === SUPER_ADMIN_SLUG && user.status === "active" &&
      (newRole.slug !== SUPER_ADMIN_SLUG || data.status !== "active");
    if (losingSuperAdmin && (await activeSuperAdminCount()) <= 1) {
      throw new AppError("VALIDATION", "At least one active Super Admin is required.");
    }

    const grant = data.grant.filter(isPermission);
    const deny = data.deny.filter(isPermission);
    const before = {
      name: user.name, email: user.email, role: oldRole?.name, status: user.status, jobTitle: user.jobTitle,
      phone: user.phone, grant: user.permissionOverrides?.grant ?? [], deny: user.permissionOverrides?.deny ?? [],
    };
    const after = { name: data.name, email: data.email, role: newRole.name, status: data.status, jobTitle: data.jobTitle, phone: data.phone, grant, deny };

    const statusChanged = user.status !== data.status;
    user.set({
      name: data.name, email: data.email, roleId: newRole._id, status: data.status,
      jobTitle: data.jobTitle, phone: data.phone, permissionOverrides: { grant, deny }, updatedBy: actor.id,
    });
    if (statusChanged && data.status !== "active") user.sessionVersion += 1;
    await user.save();
    if (statusChanged && data.status !== "active") await Session.deleteMany({ userId: user._id });

    const d = diff(before, after);
    if (d.changed) {
      await audit({ userId: actor.id, action: "update", module: "users", recordId: data.id, summary: `Updated user ${data.name}`, before: d.before, after: d.after });
    }
    refresh();
    return null;
  });
}

/** Admin-set password (no email in this deployment). Forces a change at next sign-in. */
export async function resetUserPasswordAction(input: ResetPasswordInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("users.manage");
    const data = parse(resetPasswordSchema, input);
    await connectDB();

    const user = await User.findById(data.id);
    if (!user) throw new AppError("NOT_FOUND", "User not found.");
    if (actor.id === data.id) throw new AppError("VALIDATION", "Use Account → Change password for your own account.");
    const role = await Role.findById(user.roleId).lean();
    assertCanTouchSuperAdmin(actor.isSuperAdmin, role?.slug);

    user.passwordHash = await hashPassword(data.password);
    user.mustChangePassword = true;
    user.sessionVersion += 1;
    user.set({ updatedBy: actor.id, failedLoginCount: 0, lockedUntil: null });
    await user.save();
    await Session.deleteMany({ userId: user._id });

    await audit({ userId: actor.id, action: "password_reset", module: "users", recordId: data.id, summary: `Reset password for ${user.name}` });
    refresh();
    return null;
  });
}

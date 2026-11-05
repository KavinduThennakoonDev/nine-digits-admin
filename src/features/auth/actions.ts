"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/db/models/user";
import { Session } from "@/server/db/models/session";
import { createSession, destroyCurrentSession } from "@/server/auth/session";
import { fakeVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import { getCurrentUser } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import type { ActionResult } from "@/lib/action-result";
import {
  changePasswordSchema,
  loginSchema,
  safeNext,
  updateProfileSchema,
  type ChangePasswordInput,
  type LoginInput,
  type UpdateProfileInput,
} from "./schemas";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const INVALID = "Incorrect email or password.";

export async function loginAction(input: LoginInput): Promise<ActionResult<never>> {
  const result = await runAction(async () => {
    const { email, password, remember, next } = parse(loginSchema, input);
    await connectDB();

    const user = await User.findOne({ email }).select("+passwordHash +failedLoginCount +lockedUntil");
    if (!user) {
      await fakeVerify(password);
      throw new AppError("VALIDATION", INVALID);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again in 15 minutes.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLoginCount ?? 0) + 1;
      await User.updateOne(
        { _id: user._id },
        attempts >= MAX_ATTEMPTS
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
          : { failedLoginCount: attempts },
      );
      throw new AppError("VALIDATION", INVALID);
    }
    if (user.status !== "active") {
      throw new AppError("FORBIDDEN", "Your account is disabled. Contact an administrator.");
    }

    await User.updateOne({ _id: user._id }, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
    await createSession(String(user._id), user.sessionVersion, remember);
    await audit({ userId: String(user._id), action: "login", module: "auth", recordId: String(user._id), summary: "Signed in" });
    return safeNext(next);
  });

  if (!result.ok) return result;
  redirect(result.data);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit({ userId: user.id, action: "logout", module: "auth", recordId: user.id, summary: "Signed out" });
  redirect("/login");
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const current = await getCurrentUser();
    if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
    const { currentPassword, newPassword } = parse(changePasswordSchema, input);

    const user = await User.findById(current.id).select("+passwordHash");
    if (!user) throw new AppError("NOT_FOUND", "User not found.");
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new AppError("VALIDATION", "Current password is incorrect.", { currentPassword: ["Current password is incorrect."] });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.sessionVersion += 1; // sign out every other device
    await user.save();
    await Session.deleteMany({ userId: user._id });
    await createSession(current.id, user.sessionVersion);
    await audit({ userId: current.id, action: "password_change", module: "auth", recordId: current.id, summary: "Changed password" });
    refresh(); // re-render the current route so the forced-change screen gives way to the page
    return null;
  });
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const current = await getCurrentUser();
    if (!current) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
    const data = parse(updateProfileSchema, input);

    const user = await User.findById(current.id);
    if (!user) throw new AppError("NOT_FOUND", "User not found.");
    const before = { name: user.name, phone: user.phone, jobTitle: user.jobTitle };
    user.set(data);
    await user.save();

    const d = diff(before, data);
    if (d.changed) {
      await audit({ userId: current.id, action: "update", module: "users", recordId: current.id, summary: "Updated own profile", before: d.before, after: d.after });
    }
    refresh();
    return null;
  });
}

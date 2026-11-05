import "server-only";
import { Types } from "mongoose";
import { connectDB } from "../db/connect";
import { Notification } from "../db/models/notification";
import { User } from "../db/models/user";
import { Role } from "../db/models/role";
import { resolvePermissions, type Permission } from "@/lib/permissions";
import type { NotificationType } from "@/lib/constants";

type NotifyInput = {
  type: NotificationType;
  userIds: (string | Types.ObjectId | null | undefined)[];
  title: string;
  body?: string;
  link?: string;
  /** Builds a per-recipient dedupe key; omit for one-off events. */
  dedupe?: (userId: string) => string;
  /** The person who caused it (never notified about their own action). */
  actorId?: string;
};

/**
 * Creates in-app notifications. Skips inactive users, people who muted the type
 * and the actor. Never throws — a notification failure must not break the action.
 */
export async function notify({ type, userIds, title, body = "", link = "", dedupe, actorId }: NotifyInput) {
  try {
    const ids = [...new Set(userIds.filter(Boolean).map(String))].filter((id) => id !== actorId && Types.ObjectId.isValid(id));
    if (!ids.length) return;
    await connectDB();
    const recipients = await User.find({ _id: { $in: ids }, status: "active", mutedNotifications: { $ne: type } }, { _id: 1 }).lean();
    if (!recipients.length) return;
    await Notification.insertMany(
      recipients.map((u) => ({ userId: u._id, type, title, body, link, ...(dedupe ? { dedupeKey: dedupe(String(u._id)) } : {}) })),
      { ordered: false },
    ).catch((err: { code?: number; writeErrors?: { code?: number }[] }) => {
      // Duplicate dedupe keys are expected (reminder already sent) — ignore those only.
      const dupOnly = err.code === 11000 || (err.writeErrors ?? []).every((e) => e.code === 11000);
      if (!dupOnly) throw err;
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

/** Active users whose effective permissions include all of `perms`. */
export async function usersWith(...perms: Permission[]): Promise<string[]> {
  await connectDB();
  const [users, roles] = await Promise.all([
    User.find({ status: "active" }, { roleId: 1, permissionOverrides: 1 }).lean(),
    Role.find({}, { slug: 1, permissions: 1 }).lean(),
  ]);
  const roleMap = new Map(roles.map((r) => [String(r._id), r]));
  return users
    .filter((u) => {
      const role = roleMap.get(String(u.roleId));
      if (!role) return false;
      const effective = resolvePermissions(role.slug, role.permissions, u.permissionOverrides ?? undefined);
      return perms.every((p) => effective.includes(p));
    })
    .map((u) => String(u._id));
}

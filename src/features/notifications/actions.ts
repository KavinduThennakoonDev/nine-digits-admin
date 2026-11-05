"use server";

import { refresh } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/server/db/connect";
import { Notification } from "@/server/db/models/notification";
import { User } from "@/server/db/models/user";
import { getCurrentUser } from "@/server/auth/dal";
import { AppError } from "@/server/errors";
import { runAction } from "@/server/action";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/lib/action-result";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
  await connectDB();
  return user;
}

/** Marks some (or, with no ids, all) of the current user's notifications as read. */
export async function markReadAction(ids?: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await me();
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(user.id), readAt: null };
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 500)) throw new AppError("VALIDATION", "Invalid request.");
    if (ids) filter._id = { $in: ids.filter((i) => typeof i === "string").filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i)) };
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    refresh();
    return null;
  });
}

const prefsSchema = z.object({ muted: z.array(z.enum(NOTIFICATION_TYPES)).max(NOTIFICATION_TYPES.length) });

export async function updateNotificationPrefsAction(input: z.input<typeof prefsSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await me();
    const { muted } = prefsSchema.parse(input);
    await User.updateOne({ _id: user.id }, { $set: { mutedNotifications: [...new Set(muted)] } });
    refresh();
    return null;
  });
}

import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import { Notification } from "@/server/db/models/notification";
import type { CurrentUser } from "@/server/auth/dal";
import { first, parseListParams, type Paginated, type SearchParams } from "@/lib/list-params";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/constants";

export type NotificationItem = { id: string; type: NotificationType; title: string; body: string; link: string; read: boolean; createdAt: string };

const toItem = (n: { _id: unknown; type: string; title: string; body?: string | null; link?: string | null; readAt?: Date | null; createdAt?: Date }): NotificationItem => ({
  id: String(n._id), type: n.type as NotificationType, title: n.title, body: n.body ?? "", link: n.link ?? "", read: !!n.readAt,
  createdAt: (n.createdAt ?? new Date()).toISOString(),
});

export async function getNotificationSummary(user: CurrentUser, limit = 8) {
  await connectDB();
  const userId = new Types.ObjectId(user.id);
  const [unread, items] = await Promise.all([
    Notification.countDocuments({ userId, readAt: null }),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  return { unread, items: items.map(toItem) };
}

export async function listNotifications(user: CurrentUser, sp: SearchParams): Promise<Paginated<NotificationItem>> {
  await connectDB();
  const params = parseListParams(sp, ["createdAt"], "createdAt");
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(user.id) };
  if (first(sp.show) === "unread") filter.readAt = null;
  const type = first(sp.type);
  if (type && (NOTIFICATION_TYPES as readonly string[]).includes(type)) filter.type = type;
  const [docs, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Notification.countDocuments(filter),
  ]);
  return { rows: docs.map(toItem), total, page: params.page, pageSize: params.pageSize, pageCount: Math.max(1, Math.ceil(total / params.pageSize)) };
}

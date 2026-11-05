import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { requireUser } from "@/server/auth/dal";
import { getNotificationSummary, listNotifications } from "@/features/notifications/queries";
import { NotificationsView } from "@/features/notifications/components/notifications-view";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const [data, summary] = await Promise.all([listNotifications(user, await searchParams), getNotificationSummary(user, 0)]);
  return <PageContainer className="max-w-3xl"><NotificationsView data={data} unread={summary.unread} /></PageContainer>;
}

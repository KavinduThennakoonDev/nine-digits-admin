import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getUserOptions } from "@/server/services/lookups";
import { activityFacets, listActivity } from "@/features/activity/queries";
import { ActivityView } from "@/features/activity/components/activity-view";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "activity.view")) return <AccessDenied />;
  const [data, users, facets] = await Promise.all([listActivity(await searchParams), getUserOptions(), activityFacets()]);
  return <PageContainer className="max-w-none"><ActivityView data={data} users={users} facets={facets} /></PageContainer>;
}

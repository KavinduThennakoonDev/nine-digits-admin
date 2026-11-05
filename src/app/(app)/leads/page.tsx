import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getFollowUpCounts, getLeadCountries, listLeads } from "@/features/leads/queries";
import { LeadsView } from "@/features/leads/components/leads-view";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "leads.view")) return <AccessDenied />;
  const sp = await searchParams;
  const [data, counts, countries, users, services] = await Promise.all([
    listLeads(sp), getFollowUpCounts(user), getLeadCountries(user), getUserOptions(), getServiceOptions(),
  ]);
  return (
    <PageContainer>
      <LeadsView data={data} counts={counts} countries={countries} options={{ users, services }} />
    </PageContainer>
  );
}

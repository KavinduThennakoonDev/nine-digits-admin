import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getClientCountries, listClients } from "@/features/clients/queries";
import { ClientsView } from "@/features/clients/components/clients-view";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "clients.view")) return <AccessDenied />;
  const sp = await searchParams;
  const [data, countries, users, services] = await Promise.all([
    listClients(sp), getClientCountries(user), getUserOptions(), getServiceOptions(),
  ]);
  return (
    <PageContainer>
      <ClientsView data={data} archivedView={data.archivedView} countries={countries} options={{ users, services }} />
    </PageContainer>
  );
}

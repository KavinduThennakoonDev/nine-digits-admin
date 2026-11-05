import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getTable, listRecords } from "@/features/tables/queries";
import { RecordsView } from "@/features/tables/components/records-view";

export const metadata: Metadata = { title: "Table" };

export default async function TablePage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "tables.view")) return <AccessDenied />;
  const { slug } = await params;
  const table = await getTable(slug, user);
  if (!table) notFound();
  const data = await listRecords(table, await searchParams);
  return (
    <PageContainer className="max-w-none">
      <RecordsView table={table} data={data} />
    </PageContainer>
  );
}

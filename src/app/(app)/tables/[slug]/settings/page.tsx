import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { fieldUsage, getRoleOptions, getTable, legacyCount, recordCount as countRecords } from "@/features/tables/queries";
import { StructureEditor } from "@/features/tables/components/structure-editor";

export const metadata: Metadata = { title: "Table structure" };

export default async function TableSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (!can(user, "tables.view")) return <AccessDenied />;
  const { slug } = await params;
  const table = await getTable(slug, user);
  if (!table) notFound();
  if (table.level !== "manage") return <AccessDenied message="Only people who can configure tables can change a table's structure." />;
  const [usage, legacy, roles, recordCount] = await Promise.all([
    fieldUsage(table), legacyCount(table), getRoleOptions(),
    countRecords(table),
  ]);
  return (
    <PageContainer>
      <StructureEditor table={table} usage={usage} legacy={legacy} roles={roles} recordCount={recordCount} />
    </PageContainer>
  );
}

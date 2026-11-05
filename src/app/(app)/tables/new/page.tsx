import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { TableBuilder } from "@/features/tables/components/table-builder";

export const metadata: Metadata = { title: "Create table" };

export default async function NewTablePage() {
  const user = await requireUser();
  if (!can(user, "tables.manage")) return <AccessDenied />;
  return (
    <PageContainer>
      <PageHeader title="Create table" description="Define the fields once; forms, columns and validation are generated for you." />
      <TableBuilder />
    </PageContainer>
  );
}

import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { listRoles } from "@/features/roles/queries";
import { RolesView } from "@/features/roles/components/roles-view";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  const user = await requireUser();
  if (!can(user, "users.view")) return <AccessDenied />;
  const roles = await listRoles();
  return (
    <PageContainer>
      <RolesView roles={roles} />
    </PageContainer>
  );
}

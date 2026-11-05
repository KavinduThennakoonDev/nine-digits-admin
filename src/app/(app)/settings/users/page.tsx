import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { listUsers } from "@/features/users/queries";
import { listRoles } from "@/features/roles/queries";
import { UsersView } from "@/features/users/components/users-view";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "users.view")) return <AccessDenied />;

  const sp = await searchParams;
  const [data, roles] = await Promise.all([listUsers(sp), listRoles()]);

  return (
    <PageContainer>
      <UsersView data={data} roles={roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, permissions: r.permissions }))} />
    </PageContainer>
  );
}

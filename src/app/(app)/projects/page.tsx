import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getClientOptionsForFinance } from "@/features/invoices/queries";
import { listProjects } from "@/features/projects/queries";
import { ProjectsView } from "@/features/projects/components/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "projects.view")) return <AccessDenied />;
  const [data, clients, services, users] = await Promise.all([listProjects(await searchParams), getClientOptionsForFinance(), getServiceOptions(), getUserOptions()]);
  return <PageContainer><ProjectsView data={data} options={{ clients, services, users }} /></PageContainer>;
}

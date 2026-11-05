import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { listServices } from "@/features/services/queries";
import { ServicesView } from "@/features/services/components/services-view";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requireUser();
  if (!can(user, "services.view")) return <AccessDenied />;
  const services = await listServices();
  return (
    <PageContainer>
      <ServicesView services={services} />
    </PageContainer>
  );
}

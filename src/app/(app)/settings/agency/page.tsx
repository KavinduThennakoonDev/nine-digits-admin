import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getSettings } from "@/features/settings/queries";
import { AgencyForm } from "@/features/settings/components/agency-form";
import { CurrencyForm } from "@/features/settings/components/currency-form";

export const metadata: Metadata = { title: "Settings" };

export default async function AgencySettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.manage")) return <AccessDenied />;
  const settings = await getSettings();
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Agency details, currency and invoicing defaults." />
      <AgencyForm agency={settings.agency} />
      <CurrencyForm settings={settings} />
    </PageContainer>
  );
}

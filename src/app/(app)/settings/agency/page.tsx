import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getLeadStatusUsage, getSettings } from "@/features/settings/queries";
import { LeadStatusesForm } from "@/features/settings/components/lead-statuses-form";
import { getLeadStatuses } from "@/server/services/lead-statuses";
import { AgencyForm } from "@/features/settings/components/agency-form";
import { CurrencyForm } from "@/features/settings/components/currency-form";

export const metadata: Metadata = { title: "Settings" };

export default async function AgencySettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.manage")) return <AccessDenied />;
  const [settings, statuses, usage] = await Promise.all([getSettings(), getLeadStatuses(), getLeadStatusUsage()]);
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Agency details, currency, invoicing defaults and the lead pipeline." />
      <AgencyForm agency={settings.agency} />
      <CurrencyForm settings={settings} />
      {/* Remount after a save so new statuses pick up their server-assigned keys. */}
      <LeadStatusesForm key={statuses.map((s) => `${s.key}:${s.label}:${s.tone}:${s.closed}`).join("|")} statuses={statuses} usage={usage} />
    </PageContainer>
  );
}

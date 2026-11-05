import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getClientOptionsForFinance, getPricedServices } from "@/features/invoices/queries";
import { getSettings } from "@/features/settings/queries";
import { InvoiceEditor } from "@/features/invoices/components/invoice-editor";
import { first } from "@/lib/list-params";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "invoices.manage")) return <AccessDenied />;
  const sp = await searchParams;
  const [clients, services, settings] = await Promise.all([getClientOptionsForFinance(), getPricedServices(), getSettings()]);
  // Optional ?client= prefill (from a client's page).
  const presetClient = clients.find((c) => c.value === first(sp.client));
  return (
    <PageContainer>
      <PageHeader title="New invoice" description="Draft it, then issue it when it's ready to send." />
      <InvoiceEditor
        initial={presetClient ? {
          clientId: presetClient.value, currency: presetClient.currency, issueDate: "", dueDate: "",
          lineItems: [{ serviceId: "", description: "", quantity: "1", unitPrice: "" }], discount: "", taxRate: "", notes: "", terms: "", send: false,
        } : null}
        meta={{ hasPayments: false }}
        clients={clients}
        services={services}
        defaultDueDays={settings.invoice.defaultDueDays}
        defaultTerms=""
      />
    </PageContainer>
  );
}

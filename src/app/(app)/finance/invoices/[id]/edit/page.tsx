import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getClientOptionsForFinance, getInvoiceForm, getPricedServices } from "@/features/invoices/queries";
import { getSettings } from "@/features/settings/queries";
import { InvoiceEditor } from "@/features/invoices/components/invoice-editor";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "invoices.manage")) return <AccessDenied />;
  const { id } = await params;
  const invoice = await getInvoiceForm(id);
  if (!invoice) notFound();
  if (invoice.status === "void") redirect(`/finance/invoices/${id}`);
  const [clients, services, settings] = await Promise.all([getClientOptionsForFinance(), getPricedServices(), getSettings()]);
  return (
    <PageContainer>
      <PageHeader title={`Edit ${invoice.number}`} />
      <InvoiceEditor
        initial={invoice.values}
        meta={{ number: invoice.number, status: invoice.status, hasPayments: invoice.hasPayments }}
        clients={clients}
        services={services}
        defaultDueDays={settings.invoice.defaultDueDays}
        defaultTerms=""
      />
    </PageContainer>
  );
}

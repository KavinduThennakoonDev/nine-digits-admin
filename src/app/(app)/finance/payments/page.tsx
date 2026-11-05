import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { listPayments } from "@/features/payments/queries";
import { getClientOptionsForFinance, getOpenInvoices } from "@/features/invoices/queries";
import { PaymentsView } from "@/features/payments/components/payments-view";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "payments.view")) return <AccessDenied />;
  const sp = await searchParams;
  const data = await listPayments(sp);
  const [clients, openInvoices] = await Promise.all([
    getClientOptionsForFinance(),
    getOpenInvoices(undefined, data.rows.map((r) => r.invoiceId).filter((v): v is string => !!v)),
  ]);
  return (
    <PageContainer>
      <PaymentsView data={data} options={{ clients, openInvoices }} />
    </PageContainer>
  );
}

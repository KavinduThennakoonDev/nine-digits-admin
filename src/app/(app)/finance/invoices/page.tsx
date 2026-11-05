import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { StatCard } from "@/components/feedback/stat-card";
import { can, requireUser } from "@/server/auth/dal";
import { getClientOptionsForFinance, getReceivablesSummary, listInvoices } from "@/features/invoices/queries";
import { InvoicesView } from "@/features/invoices/components/invoices-view";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "invoices.view")) return <AccessDenied />;
  const sp = await searchParams;
  const [data, clients, summary] = await Promise.all([listInvoices(sp), getClientOptionsForFinance(), getReceivablesSummary()]);
  return (
    <PageContainer>
      <InvoicesView data={data} clients={clients} summary={
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatMoney(summary.outstanding, summary.base, { compact: true })}
          hint={`${summary.openCount} unpaid invoice${summary.openCount === 1 ? "" : "s"} · in ${summary.base}`} />
        <StatCard label="Overdue" value={formatMoney(summary.overdue, summary.base, { compact: true })}
          hint={`${summary.overdueCount} past due date`} className={summary.overdueCount ? "border-destructive/30" : undefined} />
        <StatCard label="On time" value={formatMoney(summary.outstanding - summary.overdue, summary.base, { compact: true })} hint="Not yet due" />
      </div>} />
    </PageContainer>
  );
}

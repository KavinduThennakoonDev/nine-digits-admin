import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { StatusBadge } from "@/components/feedback/status-badge";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_STATUS_TONE } from "@/components/feedback/tones";
import { can, requireUser } from "@/server/auth/dal";
import { getClientOptionsForFinance, getInvoice, getOpenInvoices } from "@/features/invoices/queries";
import { InvoiceActions } from "@/features/invoices/components/invoice-actions";
import { InvoiceDocument } from "@/features/invoices/components/invoice-document";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDateTime, formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "invoices.view")) return <AccessDenied />;
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const [clients, openInvoices] = can(user, "payments.manage")
    ? await Promise.all([getClientOptionsForFinance(), getOpenInvoices(invoice.client.id, [invoice.id])])
    : [[], []];
  const paidPct = invoice.total ? Math.min(100, Math.round((invoice.amountPaid / invoice.total) * 100)) : 0;

  return (
    <PageContainer>
      <Link href="/finance/invoices" className="print-hidden inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Invoices
      </Link>
      <PageHeader
        className="print-hidden"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{invoice.number}</span>
            <StatusBadge tone={INVOICE_STATUS_TONE[invoice.displayStatus]}>{INVOICE_STATUS_LABEL[invoice.displayStatus]}</StatusBadge>
          </span>
        }
        description={<>For <Link href={`/clients/${invoice.client.id}`} className="font-medium text-foreground hover:underline">{invoice.client.clientName}</Link> · due {formatDay(invoice.dueDate)}</>}
        actions={
          <InvoiceActions id={invoice.id} number={invoice.number} status={invoice.status} balance={invoice.balance}
            hasPayments={invoice.hasPayments} paymentOptions={{ clients, openInvoices }} />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] print:block">
        <InvoiceDocument invoice={invoice} />
        <div className="print-hidden space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balance</CardTitle>
              <CardDescription>{invoice.status === "void" ? `Voided ${formatDateTime(invoice.voidedAt)}` : `${paidPct}% paid`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="tabular text-2xl font-semibold">{formatMoney(invoice.balance, invoice.currency)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
                <div className="h-full rounded-full bg-success" style={{ width: `${paidPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMoney(invoice.amountPaid, invoice.currency)} of {formatMoney(invoice.total, invoice.currency)} received
              </p>
              {invoice.voidReason ? <p className="rounded-md bg-muted p-2 text-sm">Reason: {invoice.voidReason}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>{invoice.payments.length ? `${invoice.payments.length} recorded` : "None yet"}</CardDescription>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Payments recorded against this invoice will appear here.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="tabular font-medium">{formatMoney(p.amount, p.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDay(p.paymentDate)} · {labelOf(PAYMENT_METHOD_OPTIONS, p.method)}{p.reference ? ` · ${p.reference}` : ""}
                        </p>
                        {p.refundReason ? <p className="text-xs text-muted-foreground">Refund: {p.refundReason}</p> : null}
                      </div>
                      <StatusBadge tone={PAYMENT_STATUS_TONE[p.status]}>{labelOf(PAYMENT_STATUS_OPTIONS, p.status)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <p className="px-1 text-xs text-muted-foreground">
            {invoice.createdByName ? `Created by ${invoice.createdByName}. ` : ""}
            {invoice.sentAt ? `Issued ${formatDateTime(invoice.sentAt)}.` : "Not issued yet."}
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

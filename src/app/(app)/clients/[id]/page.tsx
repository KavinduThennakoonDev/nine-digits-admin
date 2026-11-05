import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { CLIENT_STATUS_TONE } from "@/components/feedback/tones";
import { DetailList, EmailLink, PhoneLink, WhatsAppLink } from "@/components/feedback/detail-list";
import { Timeline } from "@/components/feedback/timeline";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getClient, getClientTimeline } from "@/features/clients/queries";
import { ClientActions } from "@/features/clients/components/client-actions";
import { ClientActivityComposer } from "@/features/clients/components/client-activity-composer";
import { CLIENT_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS, LEAD_SOURCE_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { first } from "@/lib/list-params";
import { StatCard } from "@/components/feedback/stat-card";
import { getClientFinanceSummary } from "@/features/finance/queries";
import { getClientProjects } from "@/features/projects/queries";
import { PROJECT_STATUS_TONE } from "@/components/feedback/tones";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants";
import { getClientOptionsForFinance, getOpenInvoices, listInvoices } from "@/features/invoices/queries";
import { listPayments } from "@/features/payments/queries";
import { listCategories, listExpenses } from "@/features/expenses/queries";
import { InvoicesView } from "@/features/invoices/components/invoices-view";
import { PaymentsView } from "@/features/payments/components/payments-view";
import { ExpensesView } from "@/features/expenses/components/expenses-view";
import { BillingTabs, type BillingTab } from "@/features/clients/components/billing-tabs";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "clients.view")) return <AccessDenied />;
  const { id } = await params;
  const client = await getClient(id, user);
  if (!client) notFound();

  const sp = await searchParams;
  const billingTabs = ([
    can(user, "invoices.view") && "invoices", can(user, "payments.view") && "payments", can(user, "expenses.view") && "expenses",
  ].filter(Boolean)) as BillingTab[];
  const requested = first(sp.tab) as BillingTab | undefined;
  const tab: BillingTab | null = requested && billingTabs.includes(requested) ? requested : billingTabs[0] ?? null;
  const billing = tab ? await loadBilling(tab, client.id, sp) : null;
  const finance = billingTabs.length ? await getClientFinanceSummary(client.id) : null;

  const projects = await getClientProjects(client.id, user);
  const [timeline, users, services] = await Promise.all([
    getClientTimeline(client.id, client.sourceLead?.id ?? null),
    getUserOptions(),
    getServiceOptions(client.services.map((s) => s.id)),
  ]);

  return (
    <PageContainer>
      <Link href="/clients" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.clientName}
            <StatusBadge tone={CLIENT_STATUS_TONE[client.status]}>{labelOf(CLIENT_STATUS_OPTIONS, client.status)}</StatusBadge>
            {client.archivedAt ? <StatusBadge tone="warning" dot={false}>Archived</StatusBadge> : null}
          </span>
        }
        description={[client.companyName, client.industry, client.country].filter(Boolean).join(" · ") || undefined}
        actions={<ClientActions id={client.id} name={client.clientName} archived={!!client.archivedAt} form={client.form} options={{ users, services }} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent>
              <DetailList items={[
                { label: "Contact person", value: client.contactPerson },
                { label: "Email", value: <EmailLink email={client.email} /> },
                { label: "Phone", value: <PhoneLink phone={client.phone} /> },
                { label: "WhatsApp", value: <WhatsAppLink phone={client.whatsapp} /> },
                { label: "Address", value: client.address },
                { label: "Country", value: client.country },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Engagement</CardTitle></CardHeader>
            <CardContent>
              <DetailList items={[
                { label: "Type", value: labelOf(CLIENT_TYPE_OPTIONS, client.clientType) },
                { label: "Account manager", value: client.assignedName ?? "Unassigned" },
                {
                  label: "Services",
                  value: client.services.length ? (
                    <span className="flex flex-wrap gap-1">
                      {client.services.map((s) => <span key={s.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{s.name}</span>)}
                    </span>
                  ) : "",
                },
                { label: "Monthly retainer", value: client.retainerMinor ? <span className="tabular">{formatMoney(client.retainerMinor, client.retainerCurrency)}</span> : "" },
                { label: "Contract start", value: client.contractStart ? formatDay(client.contractStart) : "" },
                { label: "Contract end", value: client.contractEnd ? formatDay(client.contractEnd) : "" },
                { label: "Client since", value: formatDate(client.createdAt) + (client.createdByName ? ` · by ${client.createdByName}` : "") },
              ]} />
            </CardContent>
          </Card>
          {client.sourceLead ? (
            <Card>
              <CardHeader>
                <CardTitle>Converted from lead</CardTitle>
                <CardDescription>
                  {labelOf(LEAD_SOURCE_OPTIONS, client.sourceLead.source)} lead
                  {client.sourceLead.convertedAt ? `, converted ${formatDate(client.sourceLead.convertedAt)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/leads/${client.sourceLead.id}`} className="text-sm font-medium text-primary hover:underline">
                  View {client.sourceLead.fullName}&apos;s lead history →
                </Link>
              </CardContent>
            </Card>
          ) : null}
          {can(user, "projects.view") ? (
            <Card>
              <CardHeader><CardTitle>Projects</CardTitle><CardDescription>{projects.length ? `${projects.length} project${projects.length === 1 ? "" : "s"}` : "None yet"}</CardDescription></CardHeader>
              <CardContent>
                {projects.length === 0 ? <p className="text-sm text-muted-foreground">Projects for this client will appear here.</p> : (
                  <ul className="divide-y">
                    {projects.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{p.name}</Link>
                        <StatusBadge tone={PROJECT_STATUS_TONE[p.status]}>{labelOf(PROJECT_STATUS_OPTIONS, p.status)}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
          {client.notes ? (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{client.notes}</p></CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity & communication</CardTitle>
            <CardDescription>Calls, messages, meetings and notes{client.sourceLead ? ", including the original lead history" : ""}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {can(user, "clients.update") ? <ClientActivityComposer clientId={client.id} /> : null}
            <Timeline
              items={timeline.map((t) => ({ ...t, badge: t.fromLead ? "Lead" : undefined }))}
              empty={<EmptyState icon={History} title="No activity yet" description="Log calls, meetings and notes to build this client's history." className="border-0" />}
            />
          </CardContent>
        </Card>
      </div>

      {finance && tab && billing ? (
        <section className="space-y-4" aria-labelledby="billing-heading">
          <h2 id="billing-heading" className="text-lg font-semibold tracking-tight">Billing</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {can(user, "invoices.view") ? <StatCard label="Billed" value={formatMoney(finance.billed, finance.base)} hint="Issued invoices" /> : null}
            {can(user, "payments.view") ? <StatCard label="Received" value={formatMoney(finance.received, finance.base)} hint="Completed payments" /> : null}
            {can(user, "invoices.view") ? (
              <StatCard label="Outstanding" value={formatMoney(finance.outstanding, finance.base)}
                hint={finance.overdue ? <span className="text-destructive">{formatMoney(finance.overdue, finance.base)} overdue</span> : "Nothing overdue"}
                className={finance.overdue ? "border-destructive/30" : undefined} />
            ) : null}
            {can(user, "expenses.view") ? <StatCard label="Client costs" value={formatMoney(finance.expenses, finance.base)} hint="Expenses linked to this client" /> : null}
          </div>
          <BillingTabs tabs={billingTabs} active={tab}>
            {billing.kind === "invoices" ? (
              <InvoicesView data={billing.data} clients={[]} embedded newHref={`/finance/invoices/new?client=${client.id}`} />
            ) : billing.kind === "payments" ? (
              <PaymentsView data={billing.data} options={billing.options} embedded presetClientId={client.id} />
            ) : (
              <ExpensesView data={billing.data} totalBase={billing.data.totalBase} base={billing.data.base}
                categories={billing.categories} options={billing.options} embedded presetClientId={client.id} />
            )}
          </BillingTabs>
        </section>
      ) : null}
    </PageContainer>
  );
}

type SP = Record<string, string | string[] | undefined>;

/** Fetches only the active billing tab, scoped to this client. */
async function loadBilling(tab: BillingTab, clientId: string, sp: SP) {
  if (tab === "invoices") return { kind: "invoices" as const, data: await listInvoices({ ...sp, client: clientId }) };
  if (tab === "payments") {
    const data = await listPayments(sp, clientId);
    const [clients, openInvoices] = await Promise.all([
      getClientOptionsForFinance(),
      getOpenInvoices(clientId, data.rows.map((r) => r.invoiceId).filter((v): v is string => !!v)),
    ]);
    return { kind: "payments" as const, data, options: { clients, openInvoices } };
  }
  const [data, categories, clients] = await Promise.all([listExpenses(sp, clientId), listCategories(), getClientOptionsForFinance()]);
  return {
    kind: "expenses" as const, data, categories,
    options: { categories: categories.map((c) => ({ value: c.id, label: c.name, active: c.isActive })), clients },
  };
}

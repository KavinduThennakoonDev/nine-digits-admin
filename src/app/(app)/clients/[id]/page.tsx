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

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "clients.view")) return <AccessDenied />;
  const { id } = await params;
  const client = await getClient(id, user);
  if (!client) notFound();

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
    </PageContainer>
  );
}

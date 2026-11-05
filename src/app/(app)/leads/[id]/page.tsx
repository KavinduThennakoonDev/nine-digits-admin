import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlarmClock, ArrowLeft, CalendarClock, Handshake, History, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DetailList, EmailLink, PhoneLink, WhatsAppLink } from "@/components/feedback/detail-list";
import { Timeline } from "@/components/feedback/timeline";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getLead, getLeadTimeline } from "@/features/leads/queries";
import { LeadActions, LeadStatusSwitcher } from "@/features/leads/components/lead-actions";
import { LeadActivityLogger } from "@/features/leads/components/lead-activity-logger";
import { LEAD_SOURCE_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatDay, relative, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "leads.view")) return <AccessDenied />;
  const { id } = await params;
  const lead = await getLead(id, user);
  if (!lead) notFound();

  const [timeline, users, services] = await Promise.all([
    getLeadTimeline(lead.id), getUserOptions(), getServiceOptions(lead.serviceId ? [lead.serviceId] : []),
  ]);
  const converted = lead.status === "converted";

  return (
    <PageContainer>
      <Link href="/leads" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {lead.fullName}
            <LeadStatusSwitcher id={lead.id} status={lead.status} />
            {lead.archivedAt ? <StatusBadge tone="warning" dot={false}>Archived</StatusBadge> : null}
          </span>
        }
        description={[lead.company, lead.country, `${labelOf(LEAD_SOURCE_OPTIONS, lead.source)} lead`].filter(Boolean).join(" · ")}
        actions={
          <LeadActions
            lead={{ id: lead.id, fullName: lead.fullName, company: lead.company, serviceId: lead.serviceId, assignedTo: lead.assignedTo }}
            archived={!!lead.archivedAt}
            converted={converted}
            form={lead.form}
            options={{ users, services }}
          />
        }
      />

      {converted && lead.convertedClient ? (
        <Link href={`/clients/${lead.convertedClient.id}`}
          className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm transition-colors hover:bg-success/10">
          <Handshake className="size-4 text-success" />
          <span className="flex-1">
            Converted to client <span className="font-medium">{lead.convertedClient.clientName}</span>
            {lead.convertedAt ? <span className="text-muted-foreground"> on {formatDate(lead.convertedAt)}</span> : null}
          </span>
          <span className="font-medium text-success">Open client →</span>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cn("gap-1 py-4", lead.overdue && "border-destructive/40 bg-destructive/5")}>
          <CardContent className="flex items-center gap-3 px-4">
            <span className={cn("flex size-9 items-center justify-center rounded-lg", lead.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
              {lead.overdue ? <AlarmClock className="size-4" /> : <CalendarClock className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{lead.overdue ? "Follow-up overdue" : "Next follow-up"}</p>
              <p className={cn("truncate font-medium", lead.overdue && "text-destructive")} title={formatDateTime(lead.nextFollowUpAt)}>
                {lead.nextFollowUpAt ? `${formatDateTime(lead.nextFollowUpAt)} (${relative(lead.nextFollowUpAt)})` : "Not scheduled"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Phone className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Calls logged</p>
              <p className="font-medium tabular">{lead.callCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><History className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Last contact</p>
              <p className="truncate font-medium" title={formatDateTime(lead.lastContactedAt)}>{lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : "Not contacted yet"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <DetailList items={[
                { label: "Phone", value: <PhoneLink phone={lead.phone} /> },
                { label: "WhatsApp", value: <WhatsAppLink phone={lead.whatsapp} /> },
                { label: "Email", value: <EmailLink email={lead.email} /> },
                { label: "Company", value: lead.company },
                { label: "Country", value: lead.country },
                { label: "Interested in", value: lead.serviceName ?? "" },
                { label: "Source", value: labelOf(LEAD_SOURCE_OPTIONS, lead.source) },
                { label: "Assigned to", value: lead.assignedName ?? "Unassigned" },
                { label: "Lead date", value: formatDay(lead.leadDate) },
                { label: "Added", value: formatDate(lead.createdAt) + (lead.createdByName ? ` · by ${lead.createdByName}` : "") },
              ]} />
            </CardContent>
          </Card>
          {lead.notes ? (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{lead.notes}</p></CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Every call, message, follow-up and status change on this lead.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {can(user, "leads.update") && !lead.archivedAt ? (
              <LeadActivityLogger leadId={lead.id} status={lead.status} hasFollowUp={!!lead.nextFollowUpAt} />
            ) : null}
            <Timeline items={timeline}
              empty={<EmptyState icon={History} title="No activity yet" description="Log your first call or message to start this lead's history." className="border-0" />} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

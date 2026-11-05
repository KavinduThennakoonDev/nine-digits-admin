import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, Building2, Handshake, Inbox, Sparkles, Target } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/feedback/stat-card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { LEAD_STATUS_TONE } from "@/components/feedback/tones";
import { EmptyState } from "@/components/feedback/empty-state";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getCrmStats, getRecentActivity, getRecentLeads, getUpcomingFollowUps } from "@/features/dashboard/queries";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import { FollowUpList } from "@/features/dashboard/components/follow-up-list";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!can(user, "dashboard.view")) return <AccessDenied />;

  const seesLeads = can(user, "leads.view");
  const seesClients = can(user, "clients.view");
  const [stats, activity, followUps, recentLeads] = await Promise.all([
    getCrmStats(user),
    getRecentActivity(user),
    seesLeads ? getUpcomingFollowUps(user) : [],
    seesLeads ? getRecentLeads(user) : [],
  ]);
  const firstName = user.name.split(" ")[0];
  // Vercel runs in UTC — greet in the agency's timezone.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Colombo" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const scopeNote = (all: boolean) => (all ? "" : " assigned to you");

  return (
    <PageContainer>
      <PageHeader title={`${greeting}, ${firstName}`} description="Here's what's happening across the Nine Digits workspace." />

      {seesClients || seesLeads ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {seesClients ? (
            <StatCard label={`Clients${scopeNote(can(user, "clients.view_all"))}`} value={stats.clients ?? 0}
              hint={`${stats.activeClients ?? 0} active`} icon={Building2} />
          ) : null}
          {seesLeads ? (
            <>
              <StatCard label={`Leads${scopeNote(can(user, "leads.view_all"))}`} value={stats.leads ?? 0}
                hint={`${stats.openLeads ?? 0} open`} icon={Target} />
              <StatCard label="New leads this month" value={stats.newLeads ?? 0}
                hint={`${stats.convertedThisMonth ?? 0} converted this month`} icon={Sparkles} />
              <StatCard label="Overdue follow-ups" value={stats.overdue ?? 0}
                hint={stats.overdue ? <Link href="/leads?followUp=overdue" className="text-destructive hover:underline">Review now →</Link> : "Nothing overdue"}
                icon={AlarmClock} className={stats.overdue ? "border-destructive/30" : undefined} />
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {seesLeads ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
              <CardDescription>Overdue and due in the next 7 days</CardDescription>
              <CardAction><Button variant="ghost" size="sm" asChild><Link href="/leads?followUp=today">View all</Link></Button></CardAction>
            </CardHeader>
            <CardContent><FollowUpList items={followUps} /></CardContent>
          </Card>
        ) : null}
        {seesLeads ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent leads</CardTitle>
              <CardDescription>Newest enquiries</CardDescription>
              <CardAction><Button variant="ghost" size="sm" asChild><Link href="/leads">All leads</Link></Button></CardAction>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <EmptyState icon={Inbox} title="No leads yet" description="New enquiries will show up here." className="border-0" />
              ) : (
                <ul className="-mx-2 divide-y">
                  {recentLeads.map((l) => (
                    <li key={l.id}>
                      <Link href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.fullName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{labelOf(LEAD_SOURCE_OPTIONS, l.source)} · {timeAgo(l.createdAt)}</span>
                        </span>
                        <StatusBadge tone={LEAD_STATUS_TONE[l.status]}>{labelOf(LEAD_STATUS_OPTIONS, l.status)}</StatusBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>{activity.scope === "all" ? "Latest actions across the team" : "Your latest actions"}</CardDescription>
          </CardHeader>
          <CardContent><ActivityFeed items={activity.items} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>{user.roleName}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {can(user, "leads.create") ? <Button variant="outline" asChild className="justify-start"><Link href="/leads"><Target /> Add or find a lead</Link></Button> : null}
            {seesClients ? <Button variant="outline" asChild className="justify-start"><Link href="/clients"><Building2 /> Clients</Link></Button> : null}
            {can(user, "leads.view") ? <Button variant="outline" asChild className="justify-start"><Link href="/leads?status=negotiation"><Handshake /> Deals in negotiation</Link></Button> : null}
            <Button variant="outline" asChild className="justify-start"><Link href="/account">Account & password</Link></Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

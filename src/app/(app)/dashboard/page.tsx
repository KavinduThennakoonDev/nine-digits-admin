import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, ArrowDownRight, ArrowUpRight, Building2, CheckSquare, FileWarning, FolderKanban, Handshake, Inbox, Scale, Sparkles, Target } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/feedback/stat-card";
import { LeadStatusBadge } from "@/features/leads/components/lead-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { getCrmStats, getRecentActivity, getRecentLeads, getUpcomingFollowUps } from "@/features/dashboard/queries";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import { FollowUpList } from "@/features/dashboard/components/follow-up-list";
import { LEAD_SOURCE_OPTIONS, labelOf } from "@/lib/constants";
import { formatDay, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getExpensesByCategory, getFinanceOverview, getMonthlySeries, getOverdueInvoices } from "@/features/finance/queries";
import { RevenueExpenseChart } from "@/features/finance/components/revenue-expense-chart";
import { BarList } from "@/features/finance/components/bar-list";
import { TrendChart } from "@/components/charts/trend-chart";
import { clientGrowth, leadConversionBySource, projectStatusDistribution } from "@/features/dashboard/analytics";
import { DashboardRange } from "@/features/dashboard/components/dashboard-range";
import { resolveRange } from "@/lib/periods";
import { countActiveProjects } from "@/features/projects/queries";
import { countOpenTasks, getMyOpenTasks } from "@/features/tasks/queries";
import { TaskStatusMenu } from "@/features/tasks/components/task-status-menu";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "dashboard.view")) return <AccessDenied />;

  const range = resolveRange(await searchParams, "this_month");
  const seesLeads = can(user, "leads.view");
  const seesClients = can(user, "clients.view");
  const seesFinance = can(user, "finance.view");
  const seesTasks = can(user, "tasks.view");
  const seesProjects = can(user, "projects.view");
  const [stats, activity, followUps, recentLeads, finance, overdueInvoices, myTasks, taskCounts, activeProjects] = await Promise.all([
    getCrmStats(user, range),
    getRecentActivity(user),
    seesLeads ? getUpcomingFollowUps(user) : [],
    seesLeads ? getRecentLeads(user) : [],
    seesFinance ? getFinanceOverview(range) : null,
    seesFinance ? getOverdueInvoices(5) : [],
    seesTasks ? getMyOpenTasks(user, 6) : [],
    seesTasks ? countOpenTasks(user) : null,
    seesProjects ? countActiveProjects(user) : null,
  ]);
  const [series, conversion, growth, categories, projectStatus] = await Promise.all([
    seesFinance ? getMonthlySeries() : null,
    seesLeads ? leadConversionBySource(user, range) : [],
    seesClients ? clientGrowth(user) : [],
    seesFinance ? getExpensesByCategory(range) : null,
    seesProjects ? projectStatusDistribution(user) : [],
  ]);
  const firstName = user.name.split(" ")[0];
  // Vercel runs in UTC — greet in the agency's timezone.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Colombo" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const scopeNote = (all: boolean) => (all ? "" : " assigned to you");

  return (
    <PageContainer>
      <PageHeader title={`${greeting}, ${firstName}`} description={`Here's what's happening across the Nine Digits workspace · ${range.label}.`} actions={<DashboardRange />} />

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
              <StatCard label={`New leads · ${range.label}`} value={stats.newLeads ?? 0}
                hint={`${stats.convertedThisMonth ?? 0} converted`} icon={Sparkles} />
              <StatCard label="Overdue follow-ups" value={stats.overdue ?? 0}
                hint={stats.overdue ? <Link href="/leads?followUp=overdue" className="text-destructive hover:underline">Review now →</Link> : "Nothing overdue"}
                icon={AlarmClock} className={stats.overdue ? "border-destructive/30" : undefined} />
            </>
          ) : null}
        </div>
      ) : null}

      {finance ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={`Revenue · ${range.label}`} value={formatMoney(finance.revenue, finance.base)} icon={ArrowDownRight}
            hint={<Link href="/finance" className="hover:underline">Finance overview →</Link>} />
          <StatCard label={`Expenses · ${range.label}`} value={formatMoney(finance.expenses, finance.base)} icon={ArrowUpRight}
            hint={`${finance.expenseCount} recorded`} />
          <StatCard label={`Net profit · ${range.label}`} icon={Scale}
            value={<span className={finance.profit < 0 ? "text-destructive" : undefined}>{formatMoney(finance.profit, finance.base)}</span>}
            hint={finance.margin === null ? "No revenue in this period" : `${Math.round(finance.margin * 100)}% margin`} />
          <StatCard label="Outstanding payments" value={formatMoney(finance.receivables.outstanding, finance.base)} icon={FileWarning}
            className={finance.receivables.overdueCount ? "border-destructive/30" : undefined}
            hint={finance.receivables.overdueCount
              ? <Link href="/finance/invoices?status=overdue" className="text-destructive hover:underline">{finance.receivables.overdueCount} overdue · {formatMoney(finance.receivables.overdue, finance.base)}</Link>
              : "Nothing overdue"} />
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
                        <LeadStatusBadge status={l.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {seesTasks || seesProjects ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {seesTasks ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>My tasks</CardTitle>
                <CardDescription>Open tasks assigned to you, soonest due first</CardDescription>
                <CardAction><Button variant="ghost" size="sm" asChild><Link href="/tasks?assignee=me">View all</Link></Button></CardAction>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? <EmptyState icon={CheckSquare} title="Nothing on your plate" description="Tasks assigned to you will show up here." className="border-0" /> : (
                  <ul className="-mx-2 divide-y">
                    {myTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                        <TaskStatusMenu id={t.id} status={t.status} editable={t.canUpdateStatus} />
                        <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{t.title}
                          {t.projectName ? <span className="font-normal text-muted-foreground"> · {t.projectName}</span> : null}</Link>
                        <span className={`text-xs whitespace-nowrap ${t.overdue ? "font-medium text-destructive" : t.dueToday ? "font-medium text-primary" : "text-muted-foreground"}`}>
                          {t.dueToday ? "Today" : t.dueDate ? formatDay(t.dueDate) : ""}{t.overdue ? " · overdue" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
          <div className="grid gap-4">
            {seesProjects ? <StatCard label="Active projects" value={activeProjects ?? 0} icon={FolderKanban} hint={<Link href="/projects?status=open" className="hover:underline">View projects →</Link>} /> : null}
            {taskCounts ? (
              <StatCard label="Open tasks" value={taskCounts.open} icon={CheckSquare} className={taskCounts.overdue ? "border-destructive/30" : undefined}
                hint={taskCounts.overdue ? <Link href="/tasks?due=overdue" className="text-destructive hover:underline">{taskCounts.overdue} overdue →</Link> : "None overdue"} />
            ) : null}
          </div>
        </div>
      ) : null}

      {series || conversion.length || growth.length || projectStatus.length ? (
        <section className="space-y-4" aria-labelledby="analytics-heading">
          <h2 id="analytics-heading" className="text-lg font-semibold tracking-tight">Analytics</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {series ? (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Monthly revenue vs expenses</CardTitle><CardDescription>Last 12 months · {series.base}</CardDescription></CardHeader>
                <CardContent><RevenueExpenseChart points={series.points} base={series.base} /></CardContent>
              </Card>
            ) : null}
            {seesLeads ? (
              <Card>
                <CardHeader><CardTitle>Lead conversion by source</CardTitle><CardDescription>Leads vs converted · {range.label}</CardDescription></CardHeader>
                <CardContent>
                  {conversion.length ? <TrendChart points={conversion} format="number" base={finance?.base ?? "LKR"} series={[{ key: "leads", label: "Leads" }, { key: "converted", label: "Converted" }]} height={220} />
                    : <p className="text-sm text-muted-foreground">No leads in this period.</p>}
                </CardContent>
              </Card>
            ) : null}
            {seesClients ? (
              <Card>
                <CardHeader><CardTitle>Client growth</CardTitle><CardDescription>New clients per month · last 12 months</CardDescription></CardHeader>
                <CardContent><TrendChart points={growth} format="number" base="LKR" series={[{ key: "clients", label: "New clients" }]} height={220} /></CardContent>
              </Card>
            ) : null}
            {categories ? (
              <Card>
                <CardHeader><CardTitle>Expense categories</CardTitle><CardDescription>{range.label}</CardDescription></CardHeader>
                <CardContent>
                  <BarList rows={categories.rows} base={categories.base} color="var(--chart-2)" empty={<p className="text-sm text-muted-foreground">No expenses in this period.</p>} />
                </CardContent>
              </Card>
            ) : null}
            {seesProjects ? (
              <Card>
                <CardHeader><CardTitle>Project status</CardTitle><CardDescription>All projects you can see</CardDescription></CardHeader>
                <CardContent>
                  <BarList rows={projectStatus} base="LKR" format="number" color="var(--chart-1)" empty={<p className="text-sm text-muted-foreground">No projects yet.</p>} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>{activity.scope === "all" ? "Latest actions across the team" : "Your latest actions"}</CardDescription>
          </CardHeader>
          <CardContent><ActivityFeed items={activity.items} /></CardContent>
        </Card>
        <div className="space-y-4">
        {seesFinance && overdueInvoices.length ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle>Overdue invoices</CardTitle>
              <CardDescription>Follow up on these payments</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="-mx-2 divide-y">
                {overdueInvoices.map((i) => (
                  <li key={i.id}>
                    <Link href={`/finance/invoices/${i.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{i.clientName}</span>
                        <span className="block text-xs text-muted-foreground">due {formatDay(i.dueDate)}</span>
                      </span>
                      <span className="tabular text-sm font-medium text-destructive">{formatMoney(i.balance, i.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>{user.roleName}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {can(user, "leads.create") ? <Button variant="outline" asChild className="justify-start"><Link href="/leads"><Target /> Add or find a lead</Link></Button> : null}
            {seesClients ? <Button variant="outline" asChild className="justify-start"><Link href="/clients"><Building2 /> Clients</Link></Button> : null}
            {can(user, "leads.view") ? <Button variant="outline" asChild className="justify-start"><Link href="/leads?status=negotiation"><Handshake /> Deals in negotiation</Link></Button> : null}
            {can(user, "invoices.manage") ? <Button variant="outline" asChild className="justify-start"><Link href="/finance/invoices/new">Create an invoice</Link></Button> : null}
            <Button variant="outline" asChild className="justify-start"><Link href="/account">Account & password</Link></Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </PageContainer>
  );
}

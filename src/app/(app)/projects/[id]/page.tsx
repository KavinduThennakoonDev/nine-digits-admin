import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckSquare, History, Wallet } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { DetailList } from "@/components/feedback/detail-list";
import { ProgressBar } from "@/components/feedback/progress-bar";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PRIORITY_TONE, PROJECT_STATUS_TONE } from "@/components/feedback/tones";
import { Timeline } from "@/components/feedback/timeline";
import { UserAvatar } from "@/components/layout/user-avatar";
import { can, requireUser } from "@/server/auth/dal";
import { getServiceOptions, getUserOptions } from "@/server/services/lookups";
import { getClientOptionsForFinance } from "@/features/invoices/queries";
import { getProject } from "@/features/projects/queries";
import { AddProjectTask, ProjectActions, ProjectNoteComposer } from "@/features/projects/components/project-actions";
import { TaskStatusMenu } from "@/features/tasks/components/task-status-menu";
import { getTaskFormOptions } from "@/features/tasks/options";
import { PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "projects.view")) return <AccessDenied />;
  const { id } = await params;
  const p = await getProject(id, user);
  if (!p) notFound();
  const [clients, services, users, taskOptions] = await Promise.all([
    getClientOptionsForFinance(), getServiceOptions(p.services.map((s) => s.id)), getUserOptions(), getTaskFormOptions(user, [p.id]),
  ]);
  const done = p.tasks.filter((t) => t.status === "done").length;
  const counted = p.tasks.filter((t) => t.status !== "cancelled").length;
  const over = p.budgetBase !== null && p.spentBase > p.budgetBase;

  return (
    <PageContainer>
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Projects</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{p.name}
          <StatusBadge tone={PROJECT_STATUS_TONE[p.status]}>{labelOf(PROJECT_STATUS_OPTIONS, p.status)}</StatusBadge>
          <StatusBadge tone={PRIORITY_TONE[p.priority]} dot={false}>{labelOf(PRIORITY_OPTIONS, p.priority)} priority</StatusBadge></span>}
        description={p.client ? <>For <Link href={`/clients/${p.client.id}`} className="font-medium text-foreground hover:underline">{p.client.name}</Link></> : "Internal project"}
        actions={p.canManage ? <ProjectActions id={p.id} name={p.name} form={p.form} options={{ clients, services, users }} /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-4"><CardContent className="space-y-2 px-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckSquare className="size-3.5" /> Tasks</p>
          <p className="text-lg font-semibold tabular">{done}/{counted} done</p>
          <ProgressBar value={done} max={counted} label="Tasks done" />
        </CardContent></Card>
        <Card className={`gap-2 py-4 ${over ? "border-destructive/40" : ""}`}><CardContent className="space-y-2 px-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="size-3.5" /> Budget used</p>
          <p className={`text-lg font-semibold tabular ${over ? "text-destructive" : ""}`}>
            {formatMoney(p.spentBase, p.base)}{p.budgetBase !== null ? <span className="text-sm font-normal text-muted-foreground"> of {formatMoney(p.budgetBase, p.base)}</span> : null}
          </p>
          {p.budgetBase !== null ? <ProgressBar value={p.spentBase} max={p.budgetBase} label="Budget used" /> : <p className="text-xs text-muted-foreground">No budget set</p>}
        </CardContent></Card>
        <Card className={`gap-2 py-4 ${p.overdue ? "border-destructive/40" : ""}`}><CardContent className="space-y-2 px-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> Deadline</p>
          <p className={`text-lg font-semibold ${p.overdue ? "text-destructive" : ""}`}>{p.deadline ? formatDay(p.deadline) : "Not set"}</p>
          <p className="text-xs text-muted-foreground">{p.overdue ? "Past the deadline" : p.startDate ? `Started ${formatDay(p.startDate)}` : " "}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Team</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {p.manager ? (
                <Link href={`/team/${p.manager.id}`} className="flex items-center gap-2 hover:underline"><UserAvatar name={p.manager.name} className="size-7" />
                  <span className="text-sm"><span className="font-medium">{p.manager.name}</span> <span className="text-muted-foreground">· Manager</span></span></Link>
              ) : <p className="text-sm text-muted-foreground">No manager</p>}
              {p.members.filter((m) => m.id !== p.manager?.id).map((m) => (
                <Link key={m.id} href={`/team/${m.id}`} className="flex items-center gap-2 text-sm hover:underline"><UserAvatar name={m.name} className="size-7" />{m.name}</Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <DetailList items={[
                { label: "Services", value: p.services.length ? <span className="flex flex-wrap gap-1">{p.services.map((s) => <span key={s.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{s.name}</span>)}</span> : "" },
                { label: "Budget", value: p.budget ? formatMoney(p.budget.amount, p.budget.currency) : "" },
                { label: "Start", value: p.startDate ? formatDay(p.startDate) : "" },
                { label: "Deadline", value: p.deadline ? formatDay(p.deadline) : "" },
                { label: "Created", value: formatDate(p.createdAt) },
              ]} />
              {p.description ? <p className="mt-4 border-t pt-4 text-sm whitespace-pre-wrap">{p.description}</p> : null}
            </CardContent>
          </Card>
          {can(user, "expenses.view") ? (
            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>{p.expenseCount} linked · {formatMoney(p.spentBase, p.base)}</CardDescription>
                <CardAction><Button variant="ghost" size="sm" asChild><Link href={`/finance/expenses?project=${p.id}`}>View all</Link></Button></CardAction>
              </CardHeader>
              <CardContent>
                {p.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Link expenses to this project from the Expenses page.</p> : (
                  <ul className="divide-y text-sm">
                    {p.expenses.map((e) => <li key={e.id} className="flex justify-between gap-2 py-2 first:pt-0"><span className="truncate">{e.name} <span className="text-xs text-muted-foreground">· {formatDay(e.expenseDate)}</span></span><span className="tabular">{formatMoney(e.amount, e.currency)}</span></li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>{counted - done} open</CardDescription>
              <CardAction><AddProjectTask projectId={p.id} clientId={p.client?.id ?? ""} options={taskOptions} /></CardAction>
            </CardHeader>
            <CardContent>
              {p.tasks.length === 0 ? <EmptyState icon={CheckSquare} title="No tasks yet" description="Break the project into tasks and assign them." className="border-0" /> : (
                <ul className="divide-y">
                  {p.tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <TaskStatusMenu id={t.id} status={t.status} editable={can(user, "tasks.manage")} />
                      <Link href={`/tasks/${t.id}`} className={`min-w-0 flex-1 truncate text-sm hover:underline ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</Link>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{t.assignees.join(", ")}</span>
                      <span className={`text-xs whitespace-nowrap ${t.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{t.dueDate ? formatDay(t.dueDate) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle><CardDescription>Status changes, team changes and notes</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <ProjectNoteComposer projectId={p.id} />
              <Timeline items={p.timeline} empty={<EmptyState icon={History} title="No activity yet" className="border-0" />} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { DetailList } from "@/components/feedback/detail-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PRIORITY_TONE } from "@/components/feedback/tones";
import { Timeline } from "@/components/feedback/timeline";
import { UserAvatar } from "@/components/layout/user-avatar";
import { can, requireUser } from "@/server/auth/dal";
import { getTask } from "@/features/tasks/queries";
import { getTaskFormOptions } from "@/features/tasks/options";
import { TaskActions } from "@/features/tasks/components/task-actions";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskStatusMenu } from "@/features/tasks/components/task-status-menu";
import { PRIORITY_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "tasks.view")) return <AccessDenied />;
  const { id } = await params;
  const t = await getTask(id, user);
  if (!t) notFound();
  const options = can(user, "tasks.manage") ? await getTaskFormOptions(user, t.projectId ? [t.projectId] : []) : null;
  return (
    <PageContainer className="max-w-5xl">
      <Link href="/tasks" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Tasks</Link>
      <PageHeader
        title={t.title}
        description={<span className="flex flex-wrap items-center gap-2">
          <TaskStatusMenu id={t.id} status={t.status} editable={t.canUpdateStatus} />
          <StatusBadge tone={PRIORITY_TONE[t.priority]} dot={false}>{labelOf(PRIORITY_OPTIONS, t.priority)} priority</StatusBadge>
          {t.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
        </span>}
        actions={options ? <TaskActions id={t.id} title={t.title} form={t.form} options={options} /> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {t.description ? <Card><CardContent><p className="text-sm whitespace-pre-wrap">{t.description}</p></CardContent></Card> : null}
          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent><TaskComments taskId={t.id} comments={t.comments} canDeleteAny={can(user, "tasks.manage")} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>History</CardTitle><CardDescription>Every status change and reassignment</CardDescription></CardHeader>
            <CardContent><Timeline items={t.timeline} empty={<EmptyState icon={History} title="No history yet" className="border-0" />} /></CardContent>
          </Card>
        </div>
        <Card className="lg:self-start">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList items={[
              { label: "Assignees", value: t.assignees.length ? <span className="flex flex-col gap-1.5">{t.assignees.map((a) => (
                <Link key={a.id} href={`/team/${a.id}`} className="flex items-center gap-2 hover:underline"><UserAvatar name={a.name} className="size-6" />{a.name}</Link>))}</span> : "Unassigned" },
              { label: "Due", value: t.dueDate ? <span className={t.overdue ? "font-medium text-destructive" : undefined}>{formatDay(t.dueDate)}</span> : "" },
              { label: "Project", value: t.projectId ? <Link href={`/projects/${t.projectId}`} className="text-primary hover:underline">{t.projectName}</Link> : "" },
              { label: "Client", value: t.clientName ?? "" },
              { label: "Created", value: `${formatDate(t.createdAt)}${t.createdByName ? ` by ${t.createdByName}` : ""}` },
              { label: "Completed", value: t.completedAt ? formatDateTime(t.completedAt) : "" },
            ]} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

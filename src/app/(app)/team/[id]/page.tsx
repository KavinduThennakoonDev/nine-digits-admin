import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { StatCard } from "@/components/feedback/stat-card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PROJECT_STATUS_TONE } from "@/components/feedback/tones";
import { UserAvatar } from "@/components/layout/user-avatar";
import { can, requireUser } from "@/server/auth/dal";
import { getMember } from "@/features/team/queries";
import { TaskStatusMenu } from "@/features/tasks/components/task-status-menu";
import { PROJECT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatDay, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Team member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "employees.view")) return <AccessDenied />;
  const { id } = await params;
  const m = await getMember(id, user);
  if (!m) notFound();
  return (
    <PageContainer>
      <Link href="/team" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Team</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar name={m.name} className="size-16 text-lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">{m.name}
            <StatusBadge tone={m.status === "active" ? "success" : m.status === "suspended" ? "danger" : "neutral"}><span className="capitalize">{m.status}</span></StatusBadge></h1>
          <p className="text-sm text-muted-foreground">{[m.jobTitle, m.roleName].filter(Boolean).join(" · ")} · joined {formatDate(m.createdAt)} · last sign-in {timeAgo(m.lastLoginAt)}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-3.5" />{m.email}</a>
            {m.phone ? <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="size-3.5" />{m.phone}</a> : null}
          </p>
        </div>
        {can(user, "users.manage") ? <Button variant="outline" asChild><Link href={`/settings/users?q=${encodeURIComponent(m.email)}`}>Edit role & access</Link></Button> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tasks" value={m.openTasks} hint={m.overdueTasks ? <span className="text-destructive">{m.overdueTasks} overdue</span> : "None overdue"} />
        <StatCard label="Active projects" value={m.activeProjects} />
        <StatCard label="Clients managed" value={m.clients} />
        <StatCard label="Open leads" value={m.openLeads} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Open tasks</CardTitle><CardDescription>Soonest due first</CardDescription></CardHeader>
          <CardContent>
            {m.tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : (
              <ul className="divide-y">
                {m.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <TaskStatusMenu id={t.id} status={t.status} editable={can(user, "tasks.manage") || user.id === m.id} />
                    <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{t.title}</Link>
                    <span className={`text-xs whitespace-nowrap ${t.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{t.dueDate ? formatDay(t.dueDate) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Projects</CardTitle></CardHeader>
          <CardContent>
            {m.projects.length === 0 ? <p className="text-sm text-muted-foreground">Not on any projects.</p> : (
              <ul className="divide-y">
                {m.projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">{p.name} <span className="text-xs text-muted-foreground">· {p.role}</span></Link>
                    <StatusBadge tone={PROJECT_STATUS_TONE[p.status]}>{labelOf(PROJECT_STATUS_OPTIONS, p.status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {m.activity ? (
        <Card>
          <CardHeader><CardTitle>Activity history</CardTitle><CardDescription>Latest actions in the workspace</CardDescription></CardHeader>
          <CardContent>
            {m.activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
              <ul className="divide-y text-sm">
                {m.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-4 py-2 first:pt-0">
                    <span className="min-w-0">{a.summary || `${a.action} · ${a.module}`}</span>
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { StatusBadge } from "@/components/feedback/status-badge";
import { UserAvatar } from "@/components/layout/user-avatar";
import { can, requireUser } from "@/server/auth/dal";
import { listTeam, type TeamMember } from "@/features/team/queries";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUser();
  if (!can(user, "employees.view")) return <AccessDenied />;
  const team = await listTeam();
  const active = team.filter((m) => m.status === "active");
  const others = team.filter((m) => m.status !== "active");
  return (
    <PageContainer>
      <PageHeader title="Team" description={`${active.length} active member${active.length === 1 ? "" : "s"} and what they're working on.`}
        actions={can(user, "users.view") ? <Button variant="outline" asChild><Link href="/settings/users"><Settings2 /> Manage users & roles</Link></Button> : null} />
      <TeamGrid members={active} />
      {others.length ? (<><h2 className="text-sm font-medium text-muted-foreground">Inactive</h2><TeamGrid members={others} /></>) : null}
    </PageContainer>
  );
}

function TeamGrid({ members }: { members: TeamMember[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {members.map((m) => (
        <Link key={m.id} href={`/team/${m.id}`} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Card className={`h-full gap-0 py-0 transition-colors group-hover:border-primary/40 ${m.status !== "active" ? "opacity-70" : ""}`}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <UserAvatar name={m.name} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.jobTitle || m.roleName}</p>
                </div>
                {m.status !== "active" ? <StatusBadge tone={m.status === "suspended" ? "danger" : "neutral"}><span className="capitalize">{m.status}</span></StatusBadge> : <StatusBadge dot={false}>{m.roleName}</StatusBadge>}
              </div>
              <dl className="grid grid-cols-4 gap-2 text-center">
                {[["Tasks", m.openTasks, m.overdueTasks ? `${m.overdueTasks} overdue` : ""], ["Projects", m.activeProjects, ""], ["Clients", m.clients, ""], ["Leads", m.openLeads, ""]].map(([label, n, hint]) => (
                  <div key={label as string} className="rounded-lg bg-muted/50 px-1 py-2">
                    <dd className="text-lg font-semibold tabular">{n}</dd>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    {hint ? <p className="text-[10px] font-medium text-destructive">{hint}</p> : null}
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

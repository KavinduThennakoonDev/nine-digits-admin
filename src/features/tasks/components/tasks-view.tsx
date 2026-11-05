"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckSquare, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { UrlStateProvider } from "@/components/data-table/url-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PRIORITY_TONE } from "@/components/feedback/tones";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { useCan } from "@/components/providers/session-provider";
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS, labelOf, type TaskStatus } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/lib/list-params";
import type { TaskRow } from "../queries";
import { TaskFormSheet, type TaskFormOptions } from "./task-form-sheet";
import { TaskStatusMenu } from "./task-status-menu";

const col = createDataTableColumns<TaskRow>();
const BOARD_COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done"];

function Due({ t, compact }: { t: TaskRow; compact?: boolean }) {
  if (!t.dueDate) return compact ? null : <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", t.overdue ? "font-medium text-destructive" : t.dueToday ? "font-medium text-primary" : "text-muted-foreground")}>
      <CalendarClock className="size-3.5" />{t.dueToday ? "Today" : formatDay(t.dueDate)}{t.overdue ? " · overdue" : ""}
    </span>
  );
}

function Assignees({ people }: { people: { id: string; name: string }[] }) {
  if (!people.length) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <span className="flex -space-x-1.5" title={people.map((p) => p.name).join(", ")}>
      {people.slice(0, 3).map((p) => <UserAvatar key={p.id} name={p.name} className="size-6 ring-2 ring-card" />)}
    </span>
  );
}

export function TasksView({ view, list, board, options, counts }: {
  view: "list" | "board";
  list: Paginated<TaskRow> | null;
  board: Record<TaskStatus, TaskRow[]> | null;
  options: TaskFormOptions;
  counts: { open: number; overdue: number };
}) {
  const can = useCan();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const columns = useMemo(() => [
    col.accessor("title", {
      header: "Task",
      meta: { sortKey: "title" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.title}</p>
          <p className="truncate text-xs text-muted-foreground">{[row.original.projectName, row.original.clientName].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { label: "Status" },
      cell: ({ row }) => <TaskStatusMenu id={row.original.id} status={row.original.status} editable={row.original.canUpdateStatus} />,
    }),
    col.accessor("priority", {
      header: "Priority",
      meta: { label: "Priority" },
      cell: ({ getValue }) => <StatusBadge tone={PRIORITY_TONE[getValue()]} dot={false}>{labelOf(PRIORITY_OPTIONS, getValue())}</StatusBadge>,
    }),
    col.accessor("dueDate", { header: "Due", meta: { sortKey: "dueDate", label: "Due" }, cell: ({ row }) => <Due t={row.original} /> }),
    col.accessor("assignees", { header: "Assignees", meta: { label: "Assignees" }, cell: ({ row }) => <Assignees people={row.original.assignees} /> }),
    col.accessor("commentCount", {
      header: () => <span className="sr-only">Comments</span>,
      meta: { label: "Comments", cellClassName: "w-12 text-muted-foreground" },
      cell: ({ getValue }) => (getValue() ? <span className="inline-flex items-center gap-1 text-xs"><MessageSquare className="size-3.5" />{getValue()}</span> : null),
    }),
  ], []);

  const toolbar = (
    <>
      <DataTableSegments param="view" options={[{ value: "", label: "List" }, { value: "board", label: "Board" }]} />
      <DataTableSearch placeholder="Search tasks…" />
      {view === "list" ? (
        <DataTableSelectFilter param="status" label="Status" allLabel="Open tasks" options={[...TASK_STATUS_OPTIONS, { value: "all", label: "All statuses" }]} />
      ) : null}
      <DataTableSelectFilter param="due" label="Due" allLabel="Any due date" options={[
        { value: "overdue", label: `Overdue${counts.overdue ? ` (${counts.overdue})` : ""}` }, { value: "today", label: "Due today" }, { value: "week", label: "Due this week" },
      ]} />
      <DataTableSelectFilter param="assignee" label="Assignee" allLabel="Anyone" options={[
        { value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" }, ...options.users.map((u) => ({ value: u.value, label: u.label })),
      ]} />
      <DataTableSelectFilter param="priority" label="Priorities" options={PRIORITY_OPTIONS} />
      {options.projects.length ? <DataTableSelectFilter param="project" label="Projects" options={options.projects.map((p) => ({ value: p.value, label: p.label }))} /> : null}
      <DataTableReset params={["q", "status", "due", "assignee", "priority", "project"]} />
    </>
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${counts.open} open${counts.overdue ? ` · ${counts.overdue} overdue` : ""}${can("tasks.view_all") ? "" : " · tasks assigned to or created by you"}`}
        actions={can("tasks.manage") ? <Button onClick={() => setCreating(true)}><Plus /> New task</Button> : null}
      />
      {view === "list" && list ? (
        <DataTable columns={columns} rows={list.rows} total={list.total} page={list.page} pageSize={list.pageSize} pageCount={list.pageCount}
          getRowId={(r) => r.id} defaultSort="dueDate" onRowClick={(r) => router.push(`/tasks/${r.id}`)} toolbar={toolbar}
          empty={<EmptyState icon={CheckSquare} title="No tasks here" className="border-0" description="Nothing matches these filters." />} />
      ) : board ? (
        <div className="space-y-3">
          <UrlStateProvider><div className="flex flex-wrap items-center gap-2">{toolbar}</div></UrlStateProvider>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((status) => (
              <section key={status} aria-label={labelOf(TASK_STATUS_OPTIONS, status)} className="flex min-h-40 flex-col rounded-xl border bg-muted/30">
                <header className="flex items-center justify-between px-3 py-2.5">
                  <h2 className="text-sm font-medium">{labelOf(TASK_STATUS_OPTIONS, status)}</h2>
                  <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular">{board[status].length}</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {board[status].length === 0 ? <li className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</li> : null}
                  {board[status].map((t) => (
                    <li key={t.id}>
                      <article className={cn("space-y-2 rounded-lg border bg-card p-3 shadow-xs transition-colors hover:border-primary/40", t.overdue && "border-destructive/40")}>
                        <Link href={`/tasks/${t.id}`} className="block text-sm font-medium hover:underline">{t.title}</Link>
                        {t.projectName ? <p className="truncate text-xs text-muted-foreground">{t.projectName}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <StatusBadge tone={PRIORITY_TONE[t.priority]} dot={false}>{labelOf(PRIORITY_OPTIONS, t.priority)}</StatusBadge>
                          <Due t={t} compact />
                          {t.commentCount ? <span className="inline-flex items-center gap-1 text-muted-foreground"><MessageSquare className="size-3" />{t.commentCount}</span> : null}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Assignees people={t.assignees} />
                          <TaskStatusMenu id={t.id} status={t.status} editable={t.canUpdateStatus} label={`Move ${t.title}`} />
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : null}
      <TaskFormSheet open={creating} onOpenChange={setCreating} options={options} onSaved={(id) => router.push(`/tasks/${id}`)} />
    </>
  );
}

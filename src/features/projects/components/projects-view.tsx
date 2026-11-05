"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { ProgressBar } from "@/components/feedback/progress-bar";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PRIORITY_TONE, PROJECT_STATUS_TONE } from "@/components/feedback/tones";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { useCan } from "@/components/providers/session-provider";
import { PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Paginated } from "@/lib/list-params";
import type { ProjectRow } from "../queries";
import { ProjectFormSheet, type ProjectFormOptions } from "./project-form-sheet";

const col = createDataTableColumns<ProjectRow>();

export function ProjectsView({ data, options }: { data: Paginated<ProjectRow>; options: ProjectFormOptions }) {
  const router = useRouter();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const columns = useMemo(() => [
    col.accessor("name", {
      header: "Project",
      meta: { sortKey: "name" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.clientName ?? "Internal"}</p>
        </div>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { label: "Status" },
      cell: ({ getValue }) => <StatusBadge tone={PROJECT_STATUS_TONE[getValue()]}>{labelOf(PROJECT_STATUS_OPTIONS, getValue())}</StatusBadge>,
    }),
    col.accessor("priority", {
      header: "Priority",
      meta: { sortKey: "priority", label: "Priority" },
      cell: ({ getValue }) => <StatusBadge tone={PRIORITY_TONE[getValue()]} dot={false}>{labelOf(PRIORITY_OPTIONS, getValue())}</StatusBadge>,
    }),
    col.accessor("deadline", {
      header: "Deadline",
      meta: { sortKey: "deadline", label: "Deadline" },
      cell: ({ row }) => (
        <span className={row.original.overdue ? "whitespace-nowrap font-medium text-destructive" : "whitespace-nowrap text-muted-foreground"}>
          {formatDay(row.original.deadline)}{row.original.overdue ? " · overdue" : ""}
        </span>
      ),
    }),
    col.accessor("members", {
      header: "Team",
      meta: { label: "Team" },
      cell: ({ row }) => {
        const people = [row.original.managerName, ...row.original.members].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
        return people.length ? (
          <span className="flex -space-x-1.5" title={people.join(", ")}>
            {people.slice(0, 4).map((n) => <UserAvatar key={n} name={n} className="size-6 ring-2 ring-card" />)}
            {people.length > 4 ? <span className="flex size-6 items-center justify-center rounded-lg bg-muted text-[10px] ring-2 ring-card">+{people.length - 4}</span> : null}
          </span>
        ) : <span className="text-muted-foreground">—</span>;
      },
    }),
    col.display({
      id: "tasks",
      header: "Tasks",
      meta: { label: "Tasks" },
      cell: ({ row }) => {
        const total = row.original.tasksOpen + row.original.tasksDone;
        return total ? (
          <div className="w-28 space-y-1">
            <p className="text-xs text-muted-foreground tabular">{row.original.tasksDone}/{total} done</p>
            <ProgressBar value={row.original.tasksDone} max={total} label="Tasks done" />
          </div>
        ) : <span className="text-xs text-muted-foreground">No tasks</span>;
      },
    }),
    col.display({
      id: "budget",
      header: "Budget",
      meta: { label: "Budget" },
      cell: ({ row }) => {
        const { budgetBase, spentBase, base } = row.original;
        if (budgetBase === null) return spentBase ? <span className="text-xs tabular">{formatMoney(spentBase, base, { compact: true })} spent</span> : <span className="text-muted-foreground">—</span>;
        return (
          <div className="w-32 space-y-1">
            <p className={`text-xs tabular ${spentBase > budgetBase ? "text-destructive" : "text-muted-foreground"}`}>
              {formatMoney(spentBase, base, { compact: true })} / {formatMoney(budgetBase, base, { compact: true })}
            </p>
            <ProgressBar value={spentBase} max={budgetBase} label="Budget used" />
          </div>
        );
      },
    }),
  ], []);

  return (
    <>
      <PageHeader title="Projects" description={can("projects.view_all") ? "All agency projects." : "Projects you manage or belong to."}
        actions={can("projects.manage") ? <Button onClick={() => setCreating(true)}><Plus /> New project</Button> : null} />
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="createdAt"
        onRowClick={(r) => router.push(`/projects/${r.id}`)}
        toolbar={
          <>
            <DataTableSegments param="status" options={[{ value: "", label: "All" }, { value: "open", label: "Active" }, { value: "completed", label: "Completed" }]} />
            <DataTableSearch placeholder="Search project or client…" />
            <DataTableSelectFilter param="priority" label="Priorities" options={PRIORITY_OPTIONS} />
            {can("projects.view_all") ? <DataTableSelectFilter param="member" label="People" allLabel="Everyone's" options={[{ value: "me", label: "My projects" }]} /> : null}
            {options.clients.length ? <DataTableSelectFilter param="client" label="Clients" options={options.clients.map((c) => ({ value: c.value, label: c.label }))} /> : null}
            <DataTableReset params={["q", "status", "priority", "member", "client"]} />
          </>
        }
        empty={<EmptyState icon={FolderKanban} title="No projects found" className="border-0" description="Projects group tasks, budget and expenses for a piece of client work." />}
      />
      <ProjectFormSheet open={creating} onOpenChange={setCreating} options={options} />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, Download, FileSpreadsheet, FileText, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useLeadStatuses } from "@/components/providers/lead-status-provider";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { useCan } from "@/components/providers/session-provider";
import { LEAD_SOURCE_OPTIONS, labelOf } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { RelativeTime } from "@/components/feedback/relative-time";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/lib/list-params";
import type { LeadRow } from "../queries";
import { LeadFormSheet, type LeadFormOptions } from "./lead-form-sheet";

const col = createDataTableColumns<LeadRow>();

export function LeadsView({
  data, counts, countries, options,
}: {
  data: Paginated<LeadRow>;
  counts: { overdue: number; today: number };
  countries: string[];
  options: LeadFormOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const canSeeAll = can("leads.view_all");
  const ls = useLeadStatuses();

  const exportHref = (format: "csv" | "xlsx") => {
    const p = new URLSearchParams(searchParams.toString());
    ["page", "pageSize", "sort", "dir"].forEach((k) => p.delete(k));
    p.set("format", format);
    return `/api/export/leads?${p.toString()}`;
  };

  const columns = useMemo(() => [
    col.accessor("fullName", {
      header: "Lead",
      meta: { sortKey: "fullName" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{[row.original.company, row.original.country].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    }),
    col.accessor("phone", {
      header: "Contact",
      meta: { label: "Contact" },
      cell: ({ row }) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{row.original.phone || row.original.whatsapp || row.original.email || "—"}</p>
          {row.original.email && (row.original.phone || row.original.whatsapp) ? (
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          ) : null}
        </div>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { sortKey: "status", label: "Status" },
      cell: ({ getValue }) => <StatusBadge tone={ls.tone(getValue())}>{ls.label(getValue())}</StatusBadge>,
    }),
    col.accessor("source", {
      header: "Source",
      meta: { label: "Source", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => labelOf(LEAD_SOURCE_OPTIONS, getValue()),
    }),
    col.accessor("serviceName", {
      header: "Interested in",
      meta: { label: "Interested in", cellClassName: "max-w-44 truncate text-muted-foreground" },
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    col.accessor("assignedName", {
      header: "Assigned",
      meta: { label: "Assigned" },
      cell: ({ getValue }) => {
        const name = getValue();
        return name ? (
          <span className="flex items-center gap-2"><UserAvatar name={name} className="size-6" /><span className="truncate">{name}</span></span>
        ) : <span className="text-muted-foreground">Unassigned</span>;
      },
    }),
    col.accessor("nextFollowUpAt", {
      header: "Next follow-up",
      meta: { sortKey: "nextFollowUpAt", label: "Next follow-up" },
      cell: ({ row }) => {
        const at = row.original.nextFollowUpAt;
        if (!at) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={cn("inline-flex items-center gap-1.5 text-sm", row.original.overdue ? "font-medium text-destructive" : "")}>
            {row.original.overdue ? <AlarmClock className="size-3.5" /> : null}
            <RelativeTime value={at} />
          </span>
        );
      },
    }),
    col.accessor("lastContactedAt", {
      header: "Last contact",
      meta: { sortKey: "lastContactedAt", label: "Last contact", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => (getValue() ? <RelativeTime value={getValue()} mode="ago" /> : "Never"),
    }),
    col.accessor("leadDate", {
      header: "Lead date",
      meta: { sortKey: "leadDate", label: "Lead date", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => formatDay(getValue()),
    }),
  ], [ls]);

  return (
    <>
      <PageHeader
        title="Leads"
        description={canSeeAll ? "Every enquiry, from first contact to conversion." : "Leads assigned to you."}
        actions={
          <>
            {can("leads.export") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><a href={exportHref("csv")} download><FileText /> CSV (.csv)</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href={exportHref("xlsx")} download><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {can("leads.create") ? <Button onClick={() => setCreating(true)}><Plus /> New lead</Button> : null}
          </>
        }
      />

      {counts.overdue > 0 && searchParams.get("followUp") !== "overdue" ? (
        <button
          type="button"
          onClick={() => router.replace(`${pathname}?followUp=overdue`)}
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm transition-colors hover:bg-destructive/10"
        >
          <AlarmClock className="size-4 shrink-0 text-destructive" />
          <span className="flex-1">
            <span className="font-medium text-destructive">{counts.overdue} overdue follow-up{counts.overdue === 1 ? "" : "s"}.</span>{" "}
            <span className="text-muted-foreground">These leads were due a call or message. Show them →</span>
          </span>
        </button>
      ) : null}

      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="leadDate"
        onRowClick={(r) => router.push(`/leads/${r.id}`)}
        toolbar={
          <>
            <DataTableSegments param="followUp" options={[
              { value: "", label: "All" },
              { value: "overdue", label: <span className="flex items-center gap-1.5">Overdue{counts.overdue ? <span className="rounded bg-destructive/15 px-1 text-[10px] font-semibold text-destructive tabular">{counts.overdue}</span> : null}</span> },
              { value: "today", label: <span className="flex items-center gap-1.5">Due today{counts.today ? <span className="rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary tabular">{counts.today}</span> : null}</span> },
              { value: "upcoming", label: "Upcoming" },
              { value: "none", label: "No follow-up" },
            ]} />
            <DataTableSearch placeholder="Search name, company, phone, email…" />
            <DataTableSelectFilter param="status" label="Statuses" options={[{ value: "open", label: "Open (not closed)" }, ...ls.options]} />
            <DataTableSelectFilter param="source" label="Sources" options={LEAD_SOURCE_OPTIONS} />
            {canSeeAll ? (
              <DataTableSelectFilter param="assignee" label="Assignees" options={[
                { value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" },
                ...options.users.map((u) => ({ value: u.value, label: u.label })),
              ]} />
            ) : null}
            {countries.length > 1 ? <DataTableSelectFilter param="country" label="Countries" options={countries.map((c) => ({ value: c, label: c }))} /> : null}
            {options.services.length ? <DataTableSelectFilter param="service" label="Services" options={options.services.map((s) => ({ value: s.value, label: s.label }))} /> : null}
            <DataTableSelectFilter param="view" label="Leads" options={[{ value: "archived", label: "Archived" }]} />
            <DataTableReset params={["q", "status", "source", "assignee", "country", "service", "followUp", "view"]} />
          </>
        }
        empty={
          <EmptyState icon={Target} title="No leads found" className="border-0"
            description="Try a different search or filter, or add a new lead."
            action={can("leads.create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New lead</Button> : undefined} />
        }
      />
      <LeadFormSheet open={creating} onOpenChange={setCreating} options={options} />
    </>
  );
}

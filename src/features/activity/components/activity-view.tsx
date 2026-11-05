"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "@/components/data-table/date-range-filter";
import { DetailList } from "@/components/feedback/detail-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import type { ComboOption } from "@/components/forms/combobox";
import { formatDateTime } from "@/lib/format";
import type { Paginated } from "@/lib/list-params";
import type { ActivityRow } from "../queries";

const col = createDataTableColumns<ActivityRow>();
const human = (s: string) => s.replace(/^table:/, "table · ").replace(/_/g, " ");
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function ActivityView({ data, users, facets }: { data: Paginated<ActivityRow>; users: ComboOption[]; facets: { modules: string[]; actions: string[] } }) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const columns = useMemo(() => [
    col.accessor("at", { header: "When", meta: { sortKey: "createdAt", cellClassName: "whitespace-nowrap text-muted-foreground" }, cell: ({ getValue }) => formatDateTime(getValue()) }),
    col.accessor("userName", {
      header: "User", meta: { label: "User" },
      cell: ({ getValue }) => <span className="flex items-center gap-2"><UserAvatar name={getValue()} className="size-6" /><span className="truncate">{getValue()}</span></span>,
    }),
    col.accessor("action", { header: "Action", meta: { label: "Action" }, cell: ({ getValue }) => <StatusBadge dot={false}><span className="capitalize">{human(getValue())}</span></StatusBadge> }),
    col.accessor("module", { header: "Module", meta: { label: "Module", cellClassName: "capitalize text-muted-foreground" }, cell: ({ getValue }) => human(getValue()) }),
    col.accessor("summary", { header: "Details", enableHiding: false, meta: { cellClassName: "max-w-md" }, cell: ({ getValue }) => <span className="line-clamp-2">{getValue() || "—"}</span> }),
  ], []);
  const exportHref = (format: string) => {
    const p = new URLSearchParams(searchParams.toString());
    ["page", "pageSize"].forEach((k) => p.delete(k));
    p.set("format", format);
    return `/api/activity/export?${p.toString()}`;
  };
  const keys = selected ? [...new Set([...Object.keys(selected.before ?? {}), ...Object.keys(selected.after ?? {})])] : [];

  return (
    <>
      <PageHeader title="Activity log" description="Who did what, and when. Every important change is recorded with its previous and new values."
        actions={<Button variant="outline" asChild><a href={exportHref("csv")} download><Download /> Export CSV</a></Button>} />
      <DataTable
        columns={columns} rows={data.rows} total={data.total} page={data.page} pageSize={data.pageSize} pageCount={data.pageCount}
        getRowId={(r) => r.id} defaultSort="createdAt" onRowClick={setSelected}
        toolbar={<>
          <DateRangeFilter fallback="all" />
          <DataTableSearch placeholder="Search details…" />
          <DataTableSelectFilter param="user" label="Users" options={users.map((u) => ({ value: u.value, label: u.label }))} />
          <DataTableSelectFilter param="module" label="Modules" options={facets.modules.map((m) => ({ value: m, label: human(m) }))} />
          <DataTableSelectFilter param="action" label="Actions" options={facets.actions.map((a) => ({ value: a, label: human(a) }))} />
          <DataTableReset params={["q", "user", "module", "action", "period", "from", "to"]} />
        </>}
        empty={<EmptyState icon={History} title="No activity found" description="Try a different filter or date range." className="border-0" />}
      />
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Activity details</SheetTitle>
            <SheetDescription>{selected?.summary}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <DetailList items={[
                { label: "When", value: formatDateTime(selected.at) },
                { label: "User", value: selected.userName },
                { label: "Action", value: <span className="capitalize">{human(selected.action)}</span> },
                { label: "Module", value: <span className="capitalize">{human(selected.module)}</span> },
                { label: "Record", value: selected.link ? <Link href={selected.link} className="text-primary hover:underline">Open record →</Link> : "" },
                { label: "IP address", value: selected.ip },
              ]} />
              {keys.length ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Previous</th><th className="px-3 py-2 font-medium">New</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {keys.map((k) => (
                        <tr key={k} className="align-top">
                          <td className="px-3 py-2 font-medium">{k}</td>
                          <td className="px-3 py-2 break-all text-muted-foreground line-through decoration-1">{show(selected.before?.[k])}</td>
                          <td className="px-3 py-2 break-all">{show(selected.after?.[k])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted-foreground">No field-level changes recorded for this action.</p>}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

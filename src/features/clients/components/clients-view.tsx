"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { CLIENT_STATUS_TONE } from "@/components/feedback/tones";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { useCan } from "@/components/providers/session-provider";
import { CLIENT_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS, labelOf } from "@/lib/constants";
import { formatDate, formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Paginated } from "@/lib/list-params";
import type { ClientRow } from "../queries";
import { ClientFormSheet, type ClientFormOptions } from "./client-form-sheet";

const col = createDataTableColumns<ClientRow>();

export function ClientsView({
  data, archivedView, countries, options,
}: {
  data: Paginated<ClientRow>;
  archivedView: boolean;
  countries: string[];
  options: ClientFormOptions;
}) {
  const router = useRouter();
  const can = useCan();
  const [creating, setCreating] = useState(false);
  const canCreate = can("clients.create");
  const canSeeAll = can("clients.view_all");

  const columns = useMemo(() => [
    col.accessor("clientName", {
      header: "Client",
      meta: { sortKey: "clientName" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.clientName}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.companyName || row.original.country || "—"}</p>
        </div>
      ),
    }),
    col.accessor("contactPerson", {
      header: "Contact",
      meta: { label: "Contact" },
      cell: ({ row }) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{row.original.contactPerson || row.original.email || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.phone || (row.original.contactPerson ? row.original.email : "")}</p>
        </div>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { sortKey: "status", label: "Status" },
      cell: ({ getValue }) => <StatusBadge tone={CLIENT_STATUS_TONE[getValue()]}>{labelOf(CLIENT_STATUS_OPTIONS, getValue())}</StatusBadge>,
    }),
    col.accessor("clientType", {
      header: "Type",
      meta: { label: "Type", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => labelOf(CLIENT_TYPE_OPTIONS, getValue()),
    }),
    col.accessor("assignedName", {
      header: "Account manager",
      meta: { label: "Account manager" },
      cell: ({ getValue }) => {
        const name = getValue();
        return name ? (
          <span className="flex items-center gap-2"><UserAvatar name={name} className="size-6" /><span className="truncate">{name}</span></span>
        ) : <span className="text-muted-foreground">Unassigned</span>;
      },
    }),
    col.accessor("retainerMinor", {
      header: "Retainer",
      meta: { sortKey: "monthlyRetainer.amount", label: "Retainer", headerClassName: "text-right", cellClassName: "tabular text-right" },
      cell: ({ row }) => (row.original.retainerMinor ? formatMoney(row.original.retainerMinor, row.original.retainerCurrency) : "—"),
    }),
    col.accessor("contractEnd", {
      header: "Contract ends",
      meta: { sortKey: "contractEnd", label: "Contract ends", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => formatDay(getValue()),
    }),
    col.accessor("createdAt", {
      header: "Added",
      meta: { sortKey: "createdAt", label: "Added", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => formatDate(getValue()),
    }),
  ], []);

  return (
    <>
      <PageHeader
        title="Clients"
        description={canSeeAll ? "Everyone the agency works with." : "Clients assigned to you."}
        actions={canCreate ? <Button onClick={() => setCreating(true)}><Plus /> New client</Button> : null}
      />
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="createdAt"
        onRowClick={(r) => router.push(`/clients/${r.id}`)}
        toolbar={
          <>
            <DataTableSegments param="view" options={[{ value: "", label: "Current" }, { value: "archived", label: "Archived" }]} />
            <DataTableSearch placeholder="Search name, company, email, phone…" />
            <DataTableSelectFilter param="status" label="Statuses" options={CLIENT_STATUS_OPTIONS} />
            <DataTableSelectFilter param="type" label="Types" options={CLIENT_TYPE_OPTIONS} />
            {canSeeAll ? (
              <DataTableSelectFilter param="assignee" label="Managers" options={[
                { value: "me", label: "Assigned to me" }, { value: "none", label: "Unassigned" },
                ...options.users.map((u) => ({ value: u.value, label: u.label })),
              ]} />
            ) : null}
            {countries.length > 1 ? (
              <DataTableSelectFilter param="country" label="Countries" options={countries.map((c) => ({ value: c, label: c }))} />
            ) : null}
            <DataTableReset params={["q", "status", "type", "assignee", "country"]} />
          </>
        }
        empty={
          data.total === 0 && !archivedView ? (
            <EmptyState icon={Building2} title="No clients found" className="border-0"
              description="Try a different search or filter, or add your first client."
              action={canCreate ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New client</Button> : undefined} />
          ) : (
            <EmptyState icon={Building2} title={archivedView ? "No archived clients" : "No clients found"} className="border-0"
              description={archivedView ? "Archived clients show up here." : "Try a different search or filter."} />
          )
        }
      />
      <ClientFormSheet open={creating} onOpenChange={setCreating} options={options} />
    </>
  );
}

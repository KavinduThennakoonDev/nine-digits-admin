"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/components/feedback/tones";
import { PageHeader } from "@/components/layout/page-header";
import { useCan } from "@/components/providers/session-provider";
import type { ComboOption } from "@/components/forms/combobox";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { Paginated } from "@/lib/list-params";
import type { InvoiceRow } from "../queries";

const col = createDataTableColumns<InvoiceRow>();

export function InvoicesView({ data, clients, embedded, newHref = "/finance/invoices/new", summary }: {
  data: Paginated<InvoiceRow>;
  clients: ComboOption[];
  embedded?: boolean;
  newHref?: string;
  /** Rendered between the header and the table. */
  summary?: React.ReactNode;
}) {
  const router = useRouter();
  const can = useCan();
  const canManage = can("invoices.manage");

  const columns = useMemo(() => [
    col.accessor("number", {
      header: "Invoice",
      meta: { sortKey: "number" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium">{row.original.number}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.clientName}</p>
        </div>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { label: "Status" },
      cell: ({ getValue }) => <StatusBadge tone={INVOICE_STATUS_TONE[getValue()]}>{INVOICE_STATUS_LABEL[getValue()]}</StatusBadge>,
    }),
    col.accessor("issueDate", {
      header: "Issued",
      meta: { sortKey: "issueDate", label: "Issued", cellClassName: "whitespace-nowrap text-muted-foreground" },
      cell: ({ getValue }) => formatDay(getValue()),
    }),
    col.accessor("dueDate", {
      header: "Due",
      meta: { sortKey: "dueDate", label: "Due" },
      cell: ({ row }) => (
        <span className={row.original.status === "overdue" ? "whitespace-nowrap font-medium text-destructive" : "whitespace-nowrap text-muted-foreground"}>
          {formatDay(row.original.dueDate)}
        </span>
      ),
    }),
    col.accessor("total", {
      header: "Total",
      meta: { sortKey: "total", label: "Total", headerClassName: "text-right", cellClassName: "tabular text-right" },
      cell: ({ row }) => formatMoney(row.original.total, row.original.currency),
    }),
    col.accessor("balance", {
      header: "Balance due",
      enableHiding: false,
      meta: { headerClassName: "text-right", cellClassName: "tabular text-right font-medium" },
      cell: ({ row }) => row.original.balance > 0
        ? formatMoney(row.original.balance, row.original.currency)
        : <span className="font-normal text-muted-foreground">—</span>,
    }),
  ], []);

  const newButton = canManage ? (
    <Button asChild size={embedded ? "sm" : "default"}><Link href={newHref}><Plus /> New invoice</Link></Button>
  ) : null;

  return (
    <>
      {embedded ? null : <PageHeader title="Invoices" description="Bill clients and track what's been paid." actions={newButton} />}
      {summary}
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="issueDate"
        onRowClick={(r) => router.push(`/finance/invoices/${r.id}`)}
        toolbar={
          <>
            <DataTableSegments param="status" options={[
              { value: "", label: "All" }, { value: "draft", label: "Drafts" }, { value: "open", label: "Unpaid" },
              { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" },
            ]} />
            {embedded ? null : <DataTableSearch placeholder="Search number or client…" />}
            {!embedded && clients.length ? <DataTableSelectFilter param="client" label="Clients" options={clients.map((c) => ({ value: c.value, label: c.label }))} /> : null}
            <DataTableSelectFilter param="currency" label="Currencies" options={[{ value: "LKR", label: "LKR" }, { value: "USD", label: "USD" }]} />
            <DataTableReset params={["q", "status", "client", "currency"]} />
            {embedded ? <div className="ml-auto">{newButton}</div> : null}
          </>
        }
        empty={<EmptyState icon={FileText} title="No invoices found" className="border-0"
          description="Create an invoice to bill a client." action={embedded ? undefined : newButton ?? undefined} />}
      />
    </>
  );
}

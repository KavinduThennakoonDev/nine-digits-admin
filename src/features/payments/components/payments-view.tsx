"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PAYMENT_STATUS_TONE } from "@/components/feedback/tones";
import { PageHeader } from "@/components/layout/page-header";
import { useCan } from "@/components/providers/session-provider";
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PERIOD_OPTIONS } from "@/lib/periods";
import type { Paginated } from "@/lib/list-params";
import type { PaymentRow } from "../queries";
import { PaymentSheet, type PaymentFormOptions } from "./payment-sheet";
import { RefundDialog } from "./refund-dialog";

const col = createDataTableColumns<PaymentRow>();

/** Payments table; `embedded` hides the page header (used on client pages). */
export function PaymentsView({
  data, options, embedded, presetClientId,
}: {
  data: Paginated<PaymentRow>;
  options: PaymentFormOptions;
  embedded?: boolean;
  presetClientId?: string;
}) {
  const can = useCan();
  const canManage = can("payments.manage");
  const [sheet, setSheet] = useState<{ open: boolean; row: PaymentRow | null }>({ open: false, row: null });
  const [refund, setRefund] = useState<{ id: string; label: string } | null>(null);

  const columns = useMemo(() => [
    col.accessor("paymentDate", {
      header: "Date",
      meta: { sortKey: "paymentDate", label: "Date", cellClassName: "whitespace-nowrap" },
      cell: ({ getValue }) => formatDay(getValue()),
    }),
    col.accessor("clientName", {
      header: "Client",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/clients/${row.original.clientId}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:underline">
            {row.original.clientName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.original.description || row.original.reference || "—"}</p>
        </div>
      ),
    }),
    col.accessor("invoiceNumber", {
      header: "Invoice",
      meta: { label: "Invoice" },
      cell: ({ row }) => row.original.invoiceId ? (
        <Link href={`/finance/invoices/${row.original.invoiceId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">
          {row.original.invoiceNumber}
        </Link>
      ) : <span className="text-xs text-muted-foreground">Standalone</span>,
    }),
    col.accessor("method", {
      header: "Method",
      meta: { label: "Method", cellClassName: "text-muted-foreground" },
      cell: ({ row }) => (
        <span className="block">
          {labelOf(PAYMENT_METHOD_OPTIONS, row.original.method)}
          {row.original.reference ? <span className="block truncate text-xs">{row.original.reference}</span> : null}
        </span>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      meta: { label: "Status" },
      cell: ({ row }) => (
        <span title={row.original.refundReason || undefined}>
          <StatusBadge tone={PAYMENT_STATUS_TONE[row.original.status]}>{labelOf(PAYMENT_STATUS_OPTIONS, row.original.status)}</StatusBadge>
        </span>
      ),
    }),
    col.accessor("amount", {
      header: "Amount",
      meta: { sortKey: "amount", headerClassName: "text-right", cellClassName: "tabular text-right font-medium" },
      enableHiding: false,
      cell: ({ row }) => (
        <span className={row.original.status === "completed" ? "" : "text-muted-foreground line-through decoration-1"}>
          {formatMoney(row.original.amount, row.original.currency)}
        </span>
      ),
    }),
    ...(canManage ? [col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { cellClassName: "w-10 text-right" },
      cell: ({ row }) => row.original.status === "refunded" ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Payment actions" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSheet({ open: true, row: row.original })}><Pencil /> Edit</DropdownMenuItem>
            {row.original.status === "completed" ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setRefund({
                id: row.original.id, label: `${formatMoney(row.original.amount, row.original.currency)} from ${row.original.clientName}`,
              })}><Undo2 /> Refund</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    })] : []),
  ], [canManage]);

  const addButton = canManage ? <Button onClick={() => setSheet({ open: true, row: null })} size={embedded ? "sm" : "default"}><Plus /> Record payment</Button> : null;

  return (
    <>
      {embedded ? null : (
        <PageHeader title="Payments" description="Money received from clients. Refunds stay on record; only completed payments count as revenue." actions={addButton} />
      )}
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="paymentDate"
        toolbar={
          <>
            <DataTableSearch placeholder="Search client, invoice, reference…" />
            <DataTableSelectFilter param="period" label="Time" options={PERIOD_OPTIONS.filter((p) => p.value !== "all")} />
            <DataTableSelectFilter param="status" label="Statuses" options={PAYMENT_STATUS_OPTIONS} />
            <DataTableSelectFilter param="method" label="Methods" options={PAYMENT_METHOD_OPTIONS} />
            {!presetClientId && options.clients.length ? (
              <DataTableSelectFilter param="client" label="Clients" options={options.clients.map((c) => ({ value: c.value, label: c.label }))} />
            ) : null}
            <DataTableReset params={["q", "period", "status", "method", "client"]} />
            {embedded ? <div className="ml-auto">{addButton}</div> : null}
          </>
        }
        empty={<EmptyState icon={Wallet} title="No payments found" className="border-0"
          description="Recorded payments appear here." action={embedded ? undefined : addButton ?? undefined} />}
      />
      <PaymentSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        initial={sheet.row?.form} preset={{ clientId: presetClientId }} options={options} />
      <RefundDialog payment={refund} onOpenChange={(o) => !o && setRefund(null)} />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MoreHorizontal, Pencil, Plus, Receipt, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { useCan } from "@/components/providers/session-provider";
import { PAYMENT_METHOD_OPTIONS, labelOf, type Currency } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PERIOD_OPTIONS } from "@/lib/periods";
import type { Paginated } from "@/lib/list-params";
import { deleteExpenseAction } from "../actions";
import type { CategoryRow, ExpenseRow } from "../queries";
import { CategoriesSheet } from "./categories-sheet";
import { ExpenseSheet, type ExpenseFormOptions } from "./expense-sheet";

const col = createDataTableColumns<ExpenseRow>();
const isUrl = (v: string) => /^https?:\/\//i.test(v);

export function ExpensesView({
  data, totalBase, base, categories, options, embedded, presetClientId,
}: {
  data: Paginated<ExpenseRow>;
  totalBase: number;
  base: Currency;
  categories: CategoryRow[];
  options: ExpenseFormOptions;
  embedded?: boolean;
  presetClientId?: string;
}) {
  const can = useCan();
  const canManage = can("expenses.manage");
  const [sheet, setSheet] = useState<{ open: boolean; row: ExpenseRow | null }>({ open: false, row: null });
  const [managing, setManaging] = useState(false);
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);

  const columns = useMemo(() => [
    col.accessor("expenseDate", {
      header: "Date",
      meta: { sortKey: "expenseDate", label: "Date", cellClassName: "whitespace-nowrap" },
      cell: ({ getValue }) => formatDay(getValue()),
    }),
    col.accessor("name", {
      header: "Expense",
      meta: { sortKey: "name" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">{[row.original.categoryName, row.original.clientName, row.original.projectName].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    }),
    col.accessor("method", {
      header: "Paid by",
      meta: { label: "Paid by", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => labelOf(PAYMENT_METHOD_OPTIONS, getValue()),
    }),
    col.accessor("receiptRef", {
      header: "Receipt",
      meta: { label: "Receipt" },
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span className="text-muted-foreground">—</span>;
        return isUrl(v)
          ? <a href={v} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Open <ExternalLink className="size-3" /></a>
          : <span className="text-xs">{v}</span>;
      },
    }),
    col.accessor("amount", {
      header: "Amount",
      enableHiding: false,
      meta: { sortKey: "amount", headerClassName: "text-right", cellClassName: "tabular text-right font-medium" },
      cell: ({ row }) => formatMoney(row.original.amount, row.original.currency),
    }),
    ...(canManage ? [col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { cellClassName: "w-10 text-right" },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Expense actions" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSheet({ open: true, row: row.original })}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row.original)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    })] : []),
  ], [canManage]);

  const actions = canManage ? (
    <>
      {embedded ? null : <Button variant="outline" onClick={() => setManaging(true)}><Tags /> Categories</Button>}
      <Button onClick={() => setSheet({ open: true, row: null })} size={embedded ? "sm" : "default"}><Plus /> Record expense</Button>
    </>
  ) : null;

  return (
    <>
      {embedded ? null : <PageHeader title="Expenses" description="Everything the agency spends, by category." actions={actions} />}
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="expenseDate"
        onRowClick={canManage ? (r) => setSheet({ open: true, row: r }) : undefined}
        toolbar={
          <>
            <DataTableSearch placeholder="Search expenses…" />
            <DataTableSelectFilter param="period" label="Time" options={PERIOD_OPTIONS.filter((p) => p.value !== "all")} />
            <DataTableSelectFilter param="category" label="Categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            {!presetClientId ? <DataTableSelectFilter param="client" label="Clients" options={options.clients.map((c) => ({ value: c.value, label: c.label }))} /> : null}
            <DataTableReset params={["q", "period", "category", "client", "method"]} />
            <p className="ml-auto text-sm text-muted-foreground">
              Total <span className="tabular font-semibold text-foreground">{formatMoney(totalBase, base)}</span>
            </p>
            {embedded ? actions : null}
          </>
        }
        empty={<EmptyState icon={Receipt} title="No expenses found" className="border-0" description="Recorded expenses appear here." />}
      />
      <ExpenseSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} initial={sheet.row?.form}
        presetClientId={presetClientId} options={options} />
      <CategoriesSheet open={managing} onOpenChange={setManaging} categories={categories} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this expense?"
        description={toDelete ? `“${toDelete.name}” (${formatMoney(toDelete.amount, toDelete.currency)}) will be removed from reports. The deletion is recorded in the activity log.` : ""}
        confirmLabel="Delete expense"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          const r = await deleteExpenseAction(toDelete.id);
          if (!r.ok) { toast.error(r.error.message); return false; }
          toast.success("Expense deleted.");
        }}
      />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Download, ExternalLink, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, Settings2, Table2, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@/lib/format";
import { formatValue, isFilterable, isSortable } from "@/lib/dynamic/registry";
import type { FieldDef, StoredValue } from "@/lib/dynamic/types";
import type { Paginated } from "@/lib/list-params";
import type { TableMeta } from "@/server/services/dynamic-tables";
import { deleteRecordsAction } from "../record-actions";
import type { RecordRow } from "../queries";
import { ImportDialog } from "./import-dialog";
import { RecordSheet, type EditingRecord } from "./record-sheet";
import { TableIconView } from "./table-icon";

const col = createDataTableColumns<RecordRow>();

/** A cell renderer per field type, all driven by metadata. */
function Cell({ field, value }: { field: FieldDef; value: StoredValue | undefined }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (field.type) {
    case "checkbox":
    case "boolean":
      return value ? <Check className="size-4 text-success" aria-label="Yes" /> : <span className="text-muted-foreground">No</span>;
    case "select":
      return <StatusBadge dot={false}>{formatValue(field, value)}</StatusBadge>;
    case "multiselect":
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((id) => <StatusBadge key={id} dot={false}>{formatValue(field, [id])}</StatusBadge>)}
        </span>
      );
    case "url":
    case "file":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-56 items-center gap-1 truncate text-primary hover:underline">
          <span className="truncate">{String(value).replace(/^https?:\/\//, "")}</span><ExternalLink className="size-3 shrink-0" />
        </a>
      );
    case "email":
      return <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{String(value)}</a>;
    case "textarea":
      return <span className="line-clamp-2 max-w-72 text-sm">{String(value)}</span>;
    case "number":
    case "currency":
      return <span className="tabular">{formatValue(field, value)}</span>;
    default:
      return <span className="block max-w-64 truncate">{formatValue(field, value)}</span>;
  }
}

export function RecordsView({ table, data }: { table: TableMeta; data: Paginated<RecordRow> }) {
  const canEdit = (table.level === "edit" || table.level === "manage") && !table.archivedAt;
  const canManage = table.level === "manage";
  const active = useMemo(() => table.fields.filter((f) => !f.archivedAt), [table.fields]);
  const tableFields = useMemo(() => active.filter((f) => f.showInTable), [active]);
  const formFields = useMemo(() => active.filter((f) => f.showInForm), [active]);
  const filterFields = useMemo(() => active.filter((f) => isFilterable(f.type)).slice(0, 4), [active]);

  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<{ open: boolean; record: EditingRecord }>({ open: false, record: null });
  const [importing, setImporting] = useState(false);
  const [toDelete, setToDelete] = useState<RecordRow | null>(null);

  const columns = useMemo(() => [
    ...tableFields.map((f, i) =>
      col.display({
        id: f.id,
        header: f.label,
        enableHiding: i !== 0,
        meta: { label: f.label, sortKey: isSortable(f.type) ? f.id : undefined, cellClassName: i === 0 ? "font-medium" : undefined },
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            {i === 0 && row.original.hasLegacy ? (
              <Tooltip>
                <TooltipTrigger asChild><TriangleAlert className="size-3.5 shrink-0 text-warning" aria-label="Has unconverted values" /></TooltipTrigger>
                <TooltipContent>Has a value that couldn&apos;t be converted after a field type change. Open to review.</TooltipContent>
              </Tooltip>
            ) : null}
            <Cell field={f} value={row.original.data[f.id]} />
          </span>
        ),
      }),
    ),
    col.accessor("createdAt", {
      header: "Added",
      meta: { sortKey: "createdAt", label: "Added", cellClassName: "whitespace-nowrap text-muted-foreground" },
      cell: ({ row }) => (
        <span title={row.original.createdByName ? `by ${row.original.createdByName}` : undefined}>{formatDate(row.original.createdAt)}</span>
      ),
    }),
    ...(canEdit ? [col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { cellClassName: "w-10 text-right" },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Record actions" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSheet({ open: true, record: row.original })}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row.original)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    })] : []),
  ], [tableFields, canEdit]);

  const exportHref = (format: "csv" | "xlsx") => {
    const p = new URLSearchParams(searchParams.toString());
    ["page", "pageSize"].forEach((k) => p.delete(k));
    p.set("format", format);
    return `/api/tables/${table.slug}/export?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><TableIconView icon={table.icon} className="size-4" /></span>
            {table.name}
            {table.archivedAt ? <StatusBadge tone="warning" dot={false}>Archived</StatusBadge> : null}
          </span>
        }
        description={table.description || `${active.length} fields`}
        actions={
          <>
            {canManage ? <Button variant="outline" asChild><Link href={`/tables/${table.slug}/settings`}><Settings2 /> Structure</Link></Button> : null}
            {canEdit ? <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Import CSV</Button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><a href={exportHref("csv")} download><FileText /> CSV (.csv)</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href={exportHref("xlsx")} download><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit ? <Button onClick={() => setSheet({ open: true, record: null })}><Plus /> Add record</Button> : null}
          </>
        }
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
        onRowClick={canEdit ? (r) => setSheet({ open: true, record: r }) : undefined}
        toolbar={
          <>
            <DataTableSearch placeholder={`Search ${table.name.toLowerCase()}…`} />
            {filterFields.map((f) => (
              <DataTableSelectFilter key={f.id} param={`f_${f.id}`} label={f.label} allLabel={`Any ${f.label.toLowerCase()}`}
                options={f.type === "select" || f.type === "multiselect"
                  ? f.options.map((o) => ({ value: o.id, label: o.label }))
                  : [{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            ))}
            <DataTableReset params={["q", ...filterFields.map((f) => `f_${f.id}`)]} />
          </>
        }
        empty={
          <EmptyState icon={Table2} title={data.total === 0 ? "No records yet" : "No matching records"} className="border-0"
            description={canEdit ? "Add a record or import a CSV to get started." : "Records added by your team will appear here."}
            action={canEdit ? <Button size="sm" onClick={() => setSheet({ open: true, record: null })}><Plus /> Add record</Button> : undefined} />
        }
      />
      <RecordSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} tableId={table.id} tableName={table.name}
        fields={formFields} record={sheet.record} />
      {canEdit ? <ImportDialog open={importing} onOpenChange={setImporting} tableId={table.id} fields={active} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this record?"
        description="It will be removed from the table. The deletion is recorded in the activity log."
        confirmLabel="Delete record"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          const r = await deleteRecordsAction(table.id, [toDelete.id]);
          if (!r.ok) { toast.error(r.error.message); return false; }
          toast.success("Record deleted.");
        }}
      />
    </>
  );
}

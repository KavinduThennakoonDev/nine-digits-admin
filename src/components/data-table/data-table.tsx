"use client";

import { useState } from "react";
import { useTable, type ColumnDef, type ColumnVisibilityState, type RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dataTableFeatures, type DataTableFeatures } from "./features";
import { DataTablePagination } from "./pagination";
import { DataTableViewOptions } from "./view-options";
import { UrlStateProvider, useUrlState } from "./url-state";

export type DataTableProps<T extends RowData> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  columns: ColumnDef<DataTableFeatures, T, any>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  getRowId: (row: T) => string;
  toolbar?: React.ReactNode;
  empty: React.ReactNode;
  defaultSort?: string;
  onRowClick?: (row: T) => void;
};

/** Server-driven table: data, sorting, filters and pagination all live in the URL. */
export function DataTable<T extends RowData>(props: DataTableProps<T>) {
  return (
    <UrlStateProvider>
      <DataTableInner {...props} />
    </UrlStateProvider>
  );
}

function DataTableInner<T extends RowData>({ columns, rows, total, page, pageSize, pageCount, getRowId, toolbar, empty, defaultSort, onRowClick }: DataTableProps<T>) {
  const url = useUrlState();
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const sort = url.get("sort") ?? defaultSort;
  const dir = url.get("dir") ?? "desc";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <DataTableViewOptions table={table} />
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card transition-opacity",
          url.pending && "pointer-events-none opacity-60",
        )}
        aria-busy={url.pending}
      >
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const active = meta?.sortKey && sort === meta.sortKey;
                  return (
                    <TableHead key={header.id} className={cn("h-10 text-xs font-medium text-muted-foreground", meta?.headerClassName)}>
                      {header.isPlaceholder ? null : meta?.sortKey ? (
                        <button
                          type="button"
                          className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          onClick={() =>
                            url.set({ sort: meta.sortKey!, dir: active && dir === "desc" ? "asc" : "desc" })
                          }
                        >
                          <table.FlexRender header={header} />
                          {active ? (
                            dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-6">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-2.5", cell.column.columnDef.meta?.cellClassName)}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination total={total} page={page} pageSize={pageSize} pageCount={pageCount} />
    </div>
  );
}

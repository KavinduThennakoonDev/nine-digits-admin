"use client";

import { Settings2 } from "lucide-react";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "./features";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
export function DataTableViewOptions<T extends RowData>({ table }: { table: ReactTable<DataTableFeatures, T, any> }) {
  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.columnDef.meta?.label);
  if (columns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Settings2 /> View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(v) => column.toggleVisibility(!!v)}
            onSelect={(e) => e.preventDefault()}
          >
            {column.columnDef.meta?.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

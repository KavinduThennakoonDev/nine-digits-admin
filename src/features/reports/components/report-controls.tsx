"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DateRangeFilter } from "@/components/data-table/date-range-filter";
import { UrlStateProvider } from "@/components/data-table/url-state";

export function ReportControls({ reportKey }: { reportKey: string }) {
  const sp = useSearchParams();
  const href = (format: string) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("report");
    p.set("format", format);
    return `/api/reports/${reportKey}?${p.toString()}`;
  };
  return (
    <UrlStateProvider>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter fallback="this_year" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download /> Export</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><a href={href("csv")} download><FileText /> CSV (.csv)</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={href("xlsx")} download><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </UrlStateProvider>
  );
}

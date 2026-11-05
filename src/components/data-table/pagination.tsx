"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlState } from "./url-state";

export function DataTablePagination({ total, page, pageSize, pageCount }: { total: number; page: number; pageSize: number; pageCount: number }) {
  const url = useUrlState();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => url.set({ page: p === 1 ? null : p });

  return (
    <div className="flex flex-col-reverse gap-3 px-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular">
        {total === 0 ? "No results" : <>Showing <span className="text-foreground">{from}–{to}</span> of <span className="text-foreground">{total.toLocaleString()}</span></>}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows</span>
          <Select value={String(pageSize)} onValueChange={(v) => url.set({ pageSize: v === "20" ? null : v })}>
            <SelectTrigger size="sm" className="w-18"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular">Page {page} of {pageCount}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="First page" disabled={page <= 1} onClick={() => go(1)}><ChevronsLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => go(page + 1)}><ChevronRight /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Last page" disabled={page >= pageCount} onClick={() => go(pageCount)}><ChevronsRight /></Button>
        </div>
      </div>
    </div>
  );
}

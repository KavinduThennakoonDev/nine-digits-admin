"use client";

import { UrlStateProvider, useUrlState } from "@/components/data-table/url-state";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_OPTIONS } from "@/lib/periods";

export function PeriodSegments() {
  return (
    <UrlStateProvider>
      <div className="overflow-x-auto">
        <DataTableSegments param="period" options={PERIOD_OPTIONS.filter((p) => p.value !== "last_12_months").map((p) => ({
          value: p.value === "this_month" ? "" : p.value, label: p.label,
        }))} />
      </div>
    </UrlStateProvider>
  );
}

function YearSelectInner({ years, value }: { years: number[]; value: number }) {
  const url = useUrlState();
  return (
    <Select value={String(value)} onValueChange={(v) => url.set({ year: v === String(years[0]) ? null : v })}>
      <SelectTrigger size="sm" className="w-24" aria-label="Year"><SelectValue /></SelectTrigger>
      <SelectContent align="end">{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function YearSelect(props: { years: number[]; value: number }) {
  return <UrlStateProvider><YearSelectInner {...props} /></UrlStateProvider>;
}

"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PERIOD_OPTIONS, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { useUrlState } from "./url-state";

/** Preset periods + a custom from/to range, stored in ?period= or ?from=&to=. */
export function DateRangeFilter({ fallback = "this_month", allowAll = true }: { fallback?: Period; allowAll?: boolean }) {
  const url = useUrlState();
  const from = url.get("from") ?? "";
  const to = url.get("to") ?? "";
  const period = (url.get("period") ?? fallback) as Period;
  const custom = !!(from && to);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const presets = PERIOD_OPTIONS.filter((p) => allowAll || p.value !== "all");
  const label = custom ? `${from} → ${to}` : presets.find((p) => p.value === period)?.label ?? "This month";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft({ from, to }); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><CalendarRange />{label}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="grid grid-cols-2 gap-1">
          {presets.map((p) => (
            <button key={p.value} type="button"
              className={cn("rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", !custom && period === p.value && "bg-muted font-medium")}
              onClick={() => { url.set({ period: p.value === fallback ? null : p.value, from: null, to: null }); setOpen(false); }}>
              {p.label}
            </button>
          ))}
        </div>
        <form className="space-y-2 border-t pt-3" onSubmit={(e) => {
          e.preventDefault();
          if (draft.from && draft.to && draft.from <= draft.to) { url.set({ from: draft.from, to: draft.to, period: null }); setOpen(false); }
        }}>
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="From" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            <Input type="date" aria-label="To" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </div>
          {draft.from && draft.to && draft.from > draft.to ? <p className="text-xs text-destructive">“From” must be before “To”.</p> : null}
          <Button type="submit" size="sm" className="w-full" disabled={!draft.from || !draft.to || draft.from > draft.to}>Apply range</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlState } from "./url-state";

const ALL = "__all";

export function DataTableSearch({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const url = useUrlState();
  const current = url.get(param) ?? "";
  const [value, setValue] = useState(current);
  // Keep the input in sync when the URL changes elsewhere (reset, back button).
  const [synced, setSynced] = useState(current);
  if (synced !== current) {
    setSynced(current);
    setValue(current);
  }
  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => url.set({ [param]: value.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <InputGroup className="h-8 w-full sm:w-64">
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </InputGroup>
  );
}

export function DataTableSelectFilter({
  param,
  label,
  options,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const url = useUrlState();
  const value = url.get(param) ?? ALL;
  return (
    <Select value={value} onValueChange={(v) => url.set({ [param]: v === ALL ? null : v })}>
      <SelectTrigger size="sm" className="min-w-32" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DataTableReset({ params }: { params: string[] }) {
  const url = useUrlState();
  if (!params.some((p) => url.get(p))) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => url.set(Object.fromEntries(params.map((p) => [p, null])))}>
      Reset <X />
    </Button>
  );
}

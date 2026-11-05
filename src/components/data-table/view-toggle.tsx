"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUrlState } from "./url-state";

/** Segmented control bound to a URL param ("" = default option). */
export function DataTableSegments({ param, options }: { param: string; options: { value: string; label: React.ReactNode }[] }) {
  const url = useUrlState();
  const DEFAULT = "__default";
  const value = url.get(param) ?? DEFAULT;
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => v && url.set({ [param]: v === DEFAULT ? null : v })}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value || DEFAULT} value={o.value || DEFAULT}
          className="px-2.5 text-xs data-[state=on]:bg-foreground data-[state=on]:text-background">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

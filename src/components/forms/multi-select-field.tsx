"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ComboOption } from "./combobox";
import { FieldShell } from "./field-shell";

export function MultiSelectField<T extends FieldValues>({
  control, name, label, options, placeholder = "Select…", description, className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  options: readonly ComboOption[];
  placeholder?: string;
  description?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const values: string[] = field.value ?? [];
        const toggle = (v: string) => field.onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
        return (
          <FieldShell id={id} label={label} description={description} error={fieldState.error} className={className}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open}
                  className="h-auto min-h-8 w-full justify-between py-1 font-normal">
                  <span className="flex flex-wrap gap-1">
                    {values.length === 0 ? <span className="text-muted-foreground">{placeholder}</span> : null}
                    {values.map((v) => (
                      <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        {options.find((o) => o.value === v)?.label ?? "Unknown"}
                        <span role="button" tabIndex={-1} aria-label="Remove" className="hover:text-destructive"
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(v); }}>
                          <X className="size-3" />
                        </span>
                      </span>
                    ))}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search…" />
                  <CommandList>
                    <CommandEmpty>No matches.</CommandEmpty>
                    <CommandGroup>
                      {options.map((o) => (
                        <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                          <Check className={cn("size-4", values.includes(o.value) ? "opacity-100" : "opacity-0")} />
                          {o.label}
                          {o.hint ? <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span> : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FieldShell>
        );
      }}
    />
  );
}

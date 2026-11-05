"use client";

import { useId, useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FieldShell } from "./field-shell";

/** Date-only picker. Value is "YYYY-MM-DD" (or ""), treated as a calendar day with no timezone. */
export function DateField<T extends FieldValues>({
  control, name, label, required, description, className, placeholder = "Pick a date",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  required?: boolean;
  description?: React.ReactNode;
  className?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value: string = field.value ?? "";
        // Local-midnight Date for the calendar UI only.
        const selected = value ? new Date(`${value}T00:00:00`) : undefined;
        return (
          <FieldShell id={id} label={label} required={required} description={description} error={fieldState.error} className={className}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" aria-invalid={fieldState.invalid}
                  className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground")}>
                  <CalendarIcon className="size-4 opacity-60" />
                  <span className="flex-1 text-left">{value ? formatDay(`${value}T00:00:00Z`) : placeholder}</span>
                  {value && !required ? (
                    <span role="button" tabIndex={-1} aria-label="Clear date" className="rounded p-0.5 hover:bg-muted"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); field.onChange(""); }}>
                      <X className="size-3.5" />
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selected}
                  defaultMonth={selected}
                  captionLayout="dropdown"
                  onSelect={(d) => {
                    if (!d) return field.onChange("");
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    field.onChange(`${y}-${m}-${day}`);
                    setOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </FieldShell>
        );
      }}
    />
  );
}

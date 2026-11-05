"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell } from "./field-shell";

const NONE = "__none";

export function SelectField<T extends FieldValues>({
  control, name, label, options, placeholder = "Select…", required, description, allowNone, noneLabel = "None", className, disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  description?: React.ReactNode;
  /** Adds an option that maps to "" (e.g. "Unassigned"). */
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} required={required} description={description} error={fieldState.error} className={className}>
          <Select
            value={field.value === "" && allowNone ? NONE : field.value || undefined}
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            disabled={disabled}
          >
            <SelectTrigger id={id} className="w-full" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  );
}

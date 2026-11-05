"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FieldShell } from "./field-shell";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO instant → value for <input type="datetime-local"> in the browser's timezone. */
const toLocalInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Date + time picker. Value is an ISO instant string (or ""). */
export function DateTimeField<T extends FieldValues>({
  control, name, label, required, description, className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  required?: boolean;
  description?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} required={required} description={description} error={fieldState.error} className={className}>
          <Input
            id={id}
            type="datetime-local"
            aria-invalid={fieldState.invalid}
            value={toLocalInput(field.value ?? "")}
            onBlur={field.onBlur}
            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          />
        </FieldShell>
      )}
    />
  );
}

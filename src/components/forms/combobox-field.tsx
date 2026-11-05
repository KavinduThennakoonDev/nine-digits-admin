"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Combobox, type ComboOption } from "./combobox";
import { FieldShell } from "./field-shell";

export function ComboboxField<T extends FieldValues>({
  control, name, label, options, placeholder, searchPlaceholder, required, description, className, disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  options: readonly ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  description?: React.ReactNode;
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
          <Combobox
            id={id}
            value={field.value ?? ""}
            onChange={field.onChange}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            invalid={fieldState.invalid}
            disabled={disabled}
            clearable={!required}
          />
        </FieldShell>
      )}
    />
  );
}

"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants";
import { FieldShell } from "./field-shell";

/** Amount (major units, as text) + currency. */
export function MoneyField<T extends FieldValues>({
  control, amountName, currencyName, label, required, description, className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  amountName: Path<T>;
  currencyName: Path<T>;
  label: string;
  required?: boolean;
  description?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={amountName}
      render={({ field, fieldState }) => (
        <FieldShell id={id} label={label} required={required} description={description} error={fieldState.error} className={className}>
          <InputGroup>
            <InputGroupInput
              id={id}
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              aria-invalid={fieldState.invalid}
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value.replace(/[^\d.]/g, ""))}
            />
            <InputGroupAddon align="inline-end" className="pr-1">
              <Controller
                control={control}
                name={currencyName}
                render={({ field: cur }) => (
                  <Select value={cur.value} onValueChange={cur.onChange}>
                    <SelectTrigger size="sm" className="h-6 border-0 bg-transparent px-1.5 shadow-none dark:bg-transparent" aria-label="Currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </InputGroupAddon>
          </InputGroup>
        </FieldShell>
      )}
    />
  );
}

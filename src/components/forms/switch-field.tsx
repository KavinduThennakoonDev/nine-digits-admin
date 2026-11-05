"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export function SwitchField<T extends FieldValues>({
  control, name, label, description,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  description?: React.ReactNode;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className="rounded-lg border p-3">
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description ? <FieldDescription>{description}</FieldDescription> : null}
          </FieldContent>
          <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  );
}

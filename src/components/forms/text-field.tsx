"use client";

import { useId } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props<T extends FieldValues> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
  control: Control<T, any, any>;
  name: Path<T>;
  label: string;
  description?: React.ReactNode;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  multiline?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
};

/** Labeled input bound to react-hook-form with accessible error output. */
export function TextField<T extends FieldValues>({
  control, name, label, description, placeholder, type = "text", autoComplete, multiline, required, disabled, className, inputClassName,
}: Props<T>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>
            {label}
            {required ? <span className="text-destructive">*</span> : null}
          </FieldLabel>
          {multiline ? (
            <Textarea id={id} placeholder={placeholder} disabled={disabled} aria-invalid={fieldState.invalid}
              className={inputClassName} {...field} value={field.value ?? ""} />
          ) : (
            <Input id={id} type={type} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled}
              aria-invalid={fieldState.invalid} className={inputClassName} {...field} value={field.value ?? ""} />
          )}
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

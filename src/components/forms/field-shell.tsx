"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** Shared label / description / error chrome for custom inputs. */
export function FieldShell({
  id, label, required, description, error, className, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  description?: React.ReactNode;
  error?: { message?: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

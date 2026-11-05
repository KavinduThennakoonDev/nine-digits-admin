"use client";

import { useId, useMemo } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { applyActionError } from "@/components/forms/apply-action-error";
import { defaultInput, recordSchema, toInput } from "@/lib/dynamic/registry";
import type { FieldDef, FieldInput, StoredValue } from "@/lib/dynamic/types";
import { saveRecordAction } from "../record-actions";
import { DynamicInput } from "./dynamic-input";

export type EditingRecord = { id: string; data: Record<string, StoredValue>; legacy?: Record<string, string> } | null;

export function RecordSheet({
  open, onOpenChange, tableId, tableName, fields, record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tableId: string;
  tableName: string;
  /** Active, form-visible fields in order. */
  fields: FieldDef[];
  record: EditingRecord;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{record ? "Edit record" : "New record"}</SheetTitle>
          <SheetDescription>{tableName}</SheetDescription>
        </SheetHeader>
        {open ? <RecordForm key={record?.id ?? "new"} tableId={tableId} fields={fields} record={record} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function RecordForm({ tableId, fields, record, onDone }: { tableId: string; fields: FieldDef[]; record: EditingRecord; onDone: () => void }) {
  const baseId = useId();
  // Validation is generated from the field metadata — no per-table code.
  const schema = useMemo(() => recordSchema(fields), [fields]);
  const defaults = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.id, record ? toInput(f, record.data[f.id]) : defaultInput(f)])) as Record<string, FieldInput>,
    [fields, record],
  );
  // Runtime-built schema: TS can't infer its input type, the values are FieldInput by construction.
  const form = useForm<Record<string, FieldInput>>({ resolver: zodResolver(schema) as unknown as Resolver<Record<string, FieldInput>>, defaultValues: defaults });

  const onSubmit = form.handleSubmit(async (values) => {
    const r = await saveRecordAction({ tableId, id: record?.id, values });
    if (!r.ok) return applyActionError(form, r.error);
    toast.success(record ? "Record updated." : "Record added.");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          {fields.map((f) => (
            <Controller
              key={f.id}
              control={form.control}
              name={f.id}
              render={({ field, fieldState }) => {
                const id = `${baseId}-${f.id}`;
                return (
                  <Field data-invalid={fieldState.invalid}>
                    {f.type !== "checkbox" ? (
                      <FieldLabel htmlFor={id}>{f.label}{f.required ? <span className="text-destructive">*</span> : null}</FieldLabel>
                    ) : null}
                    <DynamicInput field={f} id={id} value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={fieldState.invalid} />
                    {f.helpText ? <FieldDescription>{f.helpText}</FieldDescription> : null}
                    {record?.legacy?.[f.id] !== undefined ? (
                      <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                        Previous value <span className="font-medium">“{record.legacy[f.id]}”</span> couldn&apos;t be converted. Enter it in the new format; saving clears this note.
                      </p>
                    ) : null}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                );
              }}
            />
          ))}
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {record ? "Save changes" : "Add record"}
        </Button>
      </SheetFooter>
    </form>
  );
}

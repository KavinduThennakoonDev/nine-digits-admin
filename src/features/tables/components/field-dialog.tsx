"use client";

import { useId, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { SwitchField } from "@/components/forms/switch-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import type { ActionResult } from "@/lib/action-result";
import { CURRENCIES } from "@/lib/constants";
import { defaultInput, emptyInput, hasOptions, keyFromLabel, supportsMinMax, supportsPlaceholder } from "@/lib/dynamic/registry";
import { FIELD_TYPE_META, FIELD_TYPES, type FieldDef, type FieldInput, type FieldType } from "@/lib/dynamic/types";
import type { ConversionPreview } from "@/server/services/dynamic-tables";
import { fieldDraftSchema, type FieldDraft } from "../schemas";
import { DynamicInput } from "./dynamic-input";

export const BLANK_FIELD: FieldDraft = {
  label: "", key: "", type: "text", placeholder: "", helpText: "", required: false, defaultValue: "", options: [],
  min: "", max: "", currency: "LKR", showInTable: true, showInForm: true,
};

export const fieldToDraft = (f: FieldDef): FieldDraft => ({
  id: f.id, label: f.label, key: f.key, type: f.type, placeholder: f.placeholder, helpText: f.helpText, required: f.required,
  defaultValue: f.defaultValue, options: f.options.map((o) => ({ id: o.id, label: o.label })),
  min: f.min === null ? "" : String(f.min), max: f.max === null ? "" : String(f.max), currency: f.currency,
  showInTable: f.showInTable, showInForm: f.showInForm,
});

type SaveCtx = { confirmTypeChange: boolean; backfillDefault: boolean };

export function FieldDialog({
  open, onOpenChange, initial, originalType, recordCount = 0, onSave, onPreview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: FieldDraft | null;
  /** The saved type of an existing field (to detect type changes). */
  originalType?: FieldType;
  recordCount?: number;
  onSave: (draft: FieldDraft, ctx: SaveCtx) => Promise<ActionResult<unknown>>;
  onPreview?: (draft: FieldDraft) => Promise<ActionResult<ConversionPreview>>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>{initial?.id ? `Edit “${initial.label}”` : "Add field"}</DialogTitle>
          <DialogDescription>Fields define the columns of the table and the inputs of its form.</DialogDescription>
        </DialogHeader>
        {open ? (
          <FieldForm initial={initial ?? BLANK_FIELD} originalType={originalType} recordCount={recordCount}
            onSave={onSave} onPreview={onPreview} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FieldForm({
  initial, originalType, recordCount, onSave, onPreview, onDone,
}: {
  initial: FieldDraft;
  originalType?: FieldType;
  recordCount: number;
  onSave: (draft: FieldDraft, ctx: SaveCtx) => Promise<ActionResult<unknown>>;
  onPreview?: (draft: FieldDraft) => Promise<ActionResult<ConversionPreview>>;
  onDone: () => void;
}) {
  const uid = useId();
  const isNew = !initial.id;
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [newOption, setNewOption] = useState("");
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [backfill, setBackfill] = useState(false);
  const form = useForm({ resolver: zodResolver(fieldDraftSchema), defaultValues: initial });
  const options = useFieldArray({ control: form.control, name: "options" });
  const [type, label, opts] = useWatch({ control: form.control, name: ["type", "label", "options"] });
  const typeChanged = !!originalType && type !== originalType;

  // Unsaved options have no id yet, so they use their label (the server maps defaults by label too).
  const draftField = { type, label: label || "Default", placeholder: "", currency: form.getValues("currency"), options: (opts ?? []).map((o) => ({ id: o.id ?? o.label, label: o.label })) } as Pick<FieldDef, "type" | "label" | "placeholder" | "currency" | "options">;

  const submit = form.handleSubmit(async (values) => {
    if (typeChanged && !preview && onPreview) {
      const r = await onPreview(values);
      if (!r.ok) return applyActionError(form, r.error);
      setPreview(r.data);
      return;
    }
    const r = await onSave(values, { confirmTypeChange: typeChanged, backfillDefault: backfill });
    if (!r.ok) return applyActionError(form, r.error);
    onDone();
  });

  if (preview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <p>
            Changing <span className="font-medium">{label}</span> from <span className="font-medium">{FIELD_TYPE_META[originalType!].label}</span> to{" "}
            <span className="font-medium">{FIELD_TYPE_META[type].label}</span>:
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Records with a value</p><p className="tabular text-lg font-semibold">{preview.withValue}</p></li>
            <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Will convert</p><p className="tabular text-lg font-semibold text-success">{preview.convertible}</p></li>
            <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Set aside</p><p className={`tabular text-lg font-semibold ${preview.failureCount ? "text-destructive" : ""}`}>{preview.failureCount}</p></li>
          </ul>
          {preview.newOptions.length ? (
            <p>These options will be created from existing values: <span className="font-medium">{preview.newOptions.join(", ")}</span></p>
          ) : null}
          {preview.failureCount ? (
            <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> {preview.failureCount} value(s) can&apos;t be converted</p>
              <p className="text-muted-foreground">They won&apos;t be lost: each record keeps its old value, is marked with a warning icon in the table, and shows the old value in its edit form so you can fix it by hand.</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {preview.failures.map((f) => <li key={f.recordId}>“{f.value}” — {f.reason}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t p-4">
          <Button type="button" variant="outline" onClick={() => setPreview(null)}>Back</Button>
          <Button type="button" disabled={form.formState.isSubmitting} onClick={submit}>
            {form.formState.isSubmitting ? <Spinner /> : null} Convert {preview.convertible}{preview.failureCount ? `, set aside ${preview.failureCount}` : ""}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Controller control={form.control} name="label" render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${uid}-label`}>Field name<span className="text-destructive">*</span></FieldLabel>
              <Input id={`${uid}-label`} {...field} aria-invalid={fieldState.invalid} placeholder="e.g. Travel Date" autoFocus
                onChange={(e) => { field.onChange(e); if (!keyTouched) form.setValue("key", keyFromLabel(e.target.value)); }} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
          <Controller control={form.control} name="key" render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${uid}-key`}>Field key</FieldLabel>
              <Input id={`${uid}-key`} {...field} className="font-mono text-xs" aria-invalid={fieldState.invalid}
                onChange={(e) => { setKeyTouched(true); field.onChange(e.target.value.toLowerCase()); }} />
              <FieldDescription>Used for CSV headers. Renaming is safe.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
          <Controller control={form.control} name="type" render={({ field }) => (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${uid}-type`}>Type</FieldLabel>
              <Select value={field.value} onValueChange={(v) => {
                field.onChange(v);
                form.setValue("defaultValue", emptyInput(v as FieldType));
              }}>
                <SelectTrigger id={`${uid}-type`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="font-medium">{FIELD_TYPE_META[t].label}</span>
                      <span className="text-xs text-muted-foreground">{FIELD_TYPE_META[t].description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeChanged ? <FieldDescription>You&apos;ll see how existing values convert before anything changes.</FieldDescription> : null}
            </Field>
          )} />
        </FieldGroup>

        {hasOptions(type) ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Options</legend>
            <ul className="space-y-1.5">
              {options.fields.map((o, i) => (
                <li key={o.id} className="flex items-center gap-1.5">
                  <Input aria-label={`Option ${i + 1}`} {...form.register(`options.${i}.label`)} className="h-8" />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => options.move(i, i - 1)}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === options.fields.length - 1} onClick={() => options.move(i, i + 1)}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove option ${i + 1}`} onClick={() => options.remove(i)}><X /></Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Add an option and press Enter" aria-label="New option" className="h-8"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const v = newOption.trim();
                  if (v) { options.append({ label: v }); setNewOption(""); }
                }} />
              <Button type="button" variant="outline" size="sm" onClick={() => { const v = newOption.trim(); if (v) { options.append({ label: v }); setNewOption(""); } }}>
                <Plus /> Add
              </Button>
            </div>
            {!isNew ? <p className="text-xs text-muted-foreground">Renaming an option updates every record. Removed options stay on old records, shown as “(removed)”.</p> : null}
            <FieldError errors={[form.formState.errors.options as { message?: string } | undefined]} />
          </fieldset>
        ) : null}

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {supportsPlaceholder(type) ? <TextField control={form.control} name="placeholder" label="Placeholder" /> : null}
          {type === "currency" ? (
            <Controller control={form.control} name="currency" render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${uid}-cur`}>Currency</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${uid}-cur`} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )} />
          ) : null}
          {supportsMinMax(type) ? (
            <>
              <TextField control={form.control} name="min" label={type === "text" || type === "textarea" ? "Min length" : type === "multiselect" ? "Min choices" : "Minimum"} inputClassName="tabular" />
              <TextField control={form.control} name="max" label={type === "text" || type === "textarea" ? "Max length" : type === "multiselect" ? "Max choices" : "Maximum"} inputClassName="tabular" />
            </>
          ) : null}
          <TextField control={form.control} name="helpText" label="Help text" className="sm:col-span-2" placeholder="Shown under the input" />
          {type !== "file" ? (
            <Controller control={form.control} name="defaultValue" render={({ field, fieldState }) => (
              <Field className="sm:col-span-2" data-invalid={fieldState.invalid}>
                {type !== "checkbox" ? <FieldLabel htmlFor={`${uid}-def`}>Default value</FieldLabel> : null}
                <DynamicInput field={draftField} id={`${uid}-def`} value={defaultInput({ type, defaultValue: field.value as FieldInput })}
                  onChange={field.onChange} invalid={fieldState.invalid} />
                {type === "checkbox" ? <FieldDescription>Ticked by default</FieldDescription> : null}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )} />
          ) : null}
        </FieldGroup>

        <div className="grid gap-3 sm:grid-cols-3">
          <SwitchField control={form.control} name="required" label="Required" />
          <SwitchField control={form.control} name="showInTable" label="Show in table" />
          <SwitchField control={form.control} name="showInForm" label="Show in form" />
        </div>

        {isNew && recordCount > 0 ? (
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <Checkbox checked={backfill} onCheckedChange={(v) => setBackfill(v === true)} className="mt-0.5" />
            <span>Fill the default value into the {recordCount} existing record{recordCount === 1 ? "" : "s"}
              <span className="block text-xs text-muted-foreground">Otherwise existing records start empty for this field.</span></span>
          </label>
        ) : null}
      </div>
      <DialogFooter className="border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {typeChanged ? "Preview conversion" : isNew ? "Add field" : "Save field"}
        </Button>
      </DialogFooter>
    </form>
  );
}

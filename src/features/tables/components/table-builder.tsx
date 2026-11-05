"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { EmptyState } from "@/components/feedback/empty-state";
import { applyActionError } from "@/components/forms/apply-action-error";
import { ok, fail } from "@/lib/action-result";
import { FIELD_TYPE_META, TABLE_ICONS, type TableIcon } from "@/lib/dynamic/types";
import { cn } from "@/lib/utils";
import { createTableAction } from "../actions";
import { fieldDraftSchema, tableMetaSchema, type FieldDraft } from "../schemas";
import { FieldDialog } from "./field-dialog";
import { TableIconView } from "./table-icon";

/** The example from the brief: a ready-made structure to start from. */
const TOURIST_TEMPLATE: { name: string; description: string; icon: TableIcon; fields: FieldDraft[] } = {
  name: "Tourist Contacts",
  description: "Tourists we're in touch with about upcoming trips.",
  icon: "plane",
  fields: [
    { label: "Full Name", key: "full_name", type: "text", required: true, placeholder: "", helpText: "", defaultValue: "", options: [], min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Phone Number", key: "phone_number", type: "phone", required: false, placeholder: "", helpText: "", defaultValue: "", options: [], min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Email", key: "email", type: "email", required: false, placeholder: "", helpText: "", defaultValue: "", options: [], min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Country", key: "country", type: "select", required: false, placeholder: "", helpText: "", defaultValue: "", options: ["United Kingdom", "Germany", "India", "Australia", "United States", "China", "Other"].map((label) => ({ label })), min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Travel Date", key: "travel_date", type: "date", required: false, placeholder: "", helpText: "", defaultValue: "", options: [], min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Contacted", key: "contacted", type: "checkbox", required: false, placeholder: "", helpText: "", defaultValue: false, options: [], min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Lead Status", key: "lead_status", type: "select", required: false, placeholder: "", helpText: "", defaultValue: "New", options: ["New", "Interested", "Booked", "Not interested"].map((label) => ({ label })), min: "", max: "", currency: "LKR", showInTable: true, showInForm: true },
    { label: "Notes", key: "notes", type: "textarea", required: false, placeholder: "", helpText: "", defaultValue: "", options: [], min: "", max: "", currency: "LKR", showInTable: false, showInForm: true },
  ],
};

export function TableBuilder() {
  const router = useRouter();
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const form = useForm({ resolver: zodResolver(tableMetaSchema), defaultValues: { name: "", description: "", icon: "table" as TableIcon } });
  const icon = useWatch({ control: form.control, name: "icon" });

  const useTemplate = () => {
    form.reset({ name: TOURIST_TEMPLATE.name, description: TOURIST_TEMPLATE.description, icon: TOURIST_TEMPLATE.icon });
    setFields(TOURIST_TEMPLATE.fields);
  };
  const move = (i: number, d: -1 | 1) => setFields((fs) => { const n = [...fs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const onCreate = form.handleSubmit(async (meta) => {
    if (!fields.length) return void toast.error("Add at least one field.");
    const r = await createTableAction({ ...meta, fields });
    if (!r.ok) return applyActionError(form, r.error);
    toast.success(`“${meta.name}” created. Start adding records!`);
    router.push(`/tables/${r.data.slug}`);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="lg:self-start">
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>Name it, then add the fields you want to collect.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} noValidate>
            <FieldGroup>
              <TextField control={form.control} name="name" label="Table name" required placeholder="e.g. Tourist Contacts" />
              <TextField control={form.control} name="description" label="Description" multiline />
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Icon</legend>
                <div className="flex flex-wrap gap-1.5">
                  {TABLE_ICONS.map((i) => (
                    <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => form.setValue("icon", i)}
                      className={cn("flex size-8 items-center justify-center rounded-lg border transition-colors", icon === i ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                      <TableIconView icon={i} className="size-4" />
                    </button>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" size="lg" disabled={form.formState.isSubmitting || !fields.length}>
                {form.formState.isSubmitting ? <Spinner /> : null} Create table
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>{fields.length ? `${fields.length} field${fields.length === 1 ? "" : "s"} · the order here is the order of columns and form inputs` : "No fields yet"}</CardDescription>
          <CardAction className="flex gap-2">
            {!fields.length ? <Button variant="outline" size="sm" onClick={useTemplate}><LayoutTemplate /> Use “Tourist Contacts” template</Button> : null}
            <Button size="sm" onClick={() => setDialog({ open: true, index: null })}><Plus /> Add field</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <EmptyState icon={LayoutTemplate} title="Add your first field" description="Text, numbers, dates, dropdowns, checkboxes and more."
              action={<Button size="sm" onClick={() => setDialog({ open: true, index: null })}><Plus /> Add field</Button>} />
          ) : (
            <ol className="divide-y rounded-lg border">
              {fields.map((f, i) => (
                <li key={`${f.key}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-5 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.label}{f.required ? <span className="text-destructive"> *</span> : null}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {FIELD_TYPE_META[f.type].label}{f.options?.length ? ` · ${f.options.map((o) => o.label).join(", ")}` : ""}
                      {f.showInTable === false ? " · hidden in table" : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${f.label} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${f.label}`} onClick={() => setDialog({ open: true, index: i })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.label}`} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}><Trash2 /></Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <FieldDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.index !== null ? fields[dialog.index] : null}
        onSave={async (draft) => {
          // Local only until the table is created; the server re-validates everything.
          const parsed = fieldDraftSchema.safeParse(draft);
          if (!parsed.success) return fail("VALIDATION", "Please fix the highlighted fields.");
          if (fields.some((f, i) => f.key === draft.key && i !== dialog.index)) {
            return fail("CONFLICT", "Another field already uses this key.", { key: ["Must be unique in this table."] });
          }
          setFields((fs) => (dialog.index === null ? [...fs, draft] : fs.map((f, i) => (i === dialog.index ? draft : f))));
          return ok(null);
        }}
      />
    </div>
  );
}

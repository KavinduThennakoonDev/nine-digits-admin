"use client";

import { useId } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { applyActionError } from "@/components/forms/apply-action-error";
import { CONVERTED_STATUS, STATUS_TONES, STATUS_TONE_LABELS, isSystemStatus, type LeadStatusDef } from "@/lib/lead-statuses";
import { cn } from "@/lib/utils";
import { updateLeadStatusesAction } from "../actions";
import { leadStatusesSchema, type LeadStatusesInput } from "../schemas";

const plural = (n: number) => `${n} lead${n === 1 ? "" : "s"}`;

export function LeadStatusesForm({ statuses, usage }: { statuses: LeadStatusDef[]; usage: Record<string, number> }) {
  const uid = useId();
  const form = useForm<LeadStatusesInput>({
    resolver: zodResolver(leadStatusesSchema),
    defaultValues: { statuses, remap: {} },
  });
  const { fields, insert, remove, move } = useFieldArray({ control: form.control, name: "statuses", keyName: "rowId" });
  const rows = useWatch({ control: form.control, name: "statuses" }) ?? [];
  const remap = useWatch({ control: form.control, name: "remap" }) ?? {};

  // Saved statuses that were removed in this edit and still hold leads.
  const removed = statuses.filter((s) => !rows.some((r) => r.key === s.key) && (usage[s.key] ?? 0) > 0);
  const targets = rows.filter((r) => r.key && r.key !== CONVERTED_STATUS && r.label.trim());

  const onSubmit = form.handleSubmit(async (values) => {
    const missing = removed.find((r) => !values.remap?.[r.key]);
    if (missing) {
      toast.error(`Choose where the ${plural(usage[missing.key])} in “${missing.label}” should move.`);
      return;
    }
    const result = await updateLeadStatusesAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("Lead statuses saved.");
  });

  const rootError = form.formState.errors.statuses?.root?.message ?? form.formState.errors.statuses?.message;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>Lead statuses</CardTitle>
          <CardDescription>
            The stages a lead moves through, in order. <strong className="font-medium text-foreground">Closed</strong> statuses mean the lead is finished:
            they don&apos;t count as open and get no follow-up reminders. “New” and “Converted” are built in. You can rename and recolour them, but not remove them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="divide-y rounded-lg border" aria-label="Lead statuses">
            {fields.map((f, i) => {
              const row = rows[i] ?? f;
              const system = isSystemStatus(row.key ?? "");
              const count = row.key ? usage[row.key] ?? 0 : 0;
              const labelError = form.formState.errors.statuses?.[i]?.label?.message;
              return (
                <li key={f.rowId} className="flex flex-wrap items-center gap-2 p-2.5 sm:flex-nowrap">
                  <div className="flex shrink-0 flex-col">
                    <Button type="button" variant="ghost" size="icon" className="size-6" disabled={i === 0}
                      aria-label={`Move ${row.label || "status"} up`} onClick={() => move(i, i - 1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-6" disabled={i === fields.length - 1}
                      aria-label={`Move ${row.label || "status"} down`} onClick={() => move(i, i + 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                  <div className="min-w-40 flex-1">
                    <Input
                      {...form.register(`statuses.${i}.label`)}
                      defaultValue={f.label}
                      aria-label={`Status ${i + 1} name`}
                      aria-invalid={!!labelError}
                      placeholder="Status name"
                      maxLength={40}
                    />
                    {labelError ? <p className="mt-1 text-xs text-destructive">{labelError}</p> : null}
                  </div>
                  <Controller
                    control={form.control}
                    name={`statuses.${i}.tone`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-32 shrink-0" aria-label={`Status ${i + 1} colour`}>
                          {/* Explicit children so the colour shows before hydration too. */}
                          <SelectValue><StatusBadge tone={field.value}>{STATUS_TONE_LABELS[field.value]}</StatusBadge></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_TONES.map((t) => (
                            <SelectItem key={t} value={t}>
                              <StatusBadge tone={t}>{STATUS_TONE_LABELS[t]}</StatusBadge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name={`statuses.${i}.closed`}
                    render={({ field }) => (
                      <label className={cn("flex shrink-0 items-center gap-2 text-sm", system && "text-muted-foreground")} htmlFor={`${uid}-closed-${i}`}>
                        <Switch id={`${uid}-closed-${i}`} checked={field.value} onCheckedChange={field.onChange} disabled={system}
                          aria-label={`${row.label || "Status"} is closed`} />
                        Closed
                      </label>
                    )}
                  />
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular">{row.key ? plural(count) : "New"}</span>
                  {system ? (
                    <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground" title="Built in — can't be removed">
                      <Lock className="size-3.5" aria-label="Built in" />
                    </span>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${row.label || "status"}`} onClick={() => remove(i)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
          {rootError ? <p className="text-sm text-destructive">{rootError}</p> : null}

          {removed.length ? (
            <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <p className="text-sm font-medium">Removed statuses still hold leads. Where should they go?</p>
              {removed.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge tone={r.tone}>{r.label}</StatusBadge>
                  <span className="text-muted-foreground">{plural(usage[r.key])} → move to</span>
                  <Select value={remap[r.key] ?? ""} onValueChange={(v) => form.setValue("remap", { ...remap, [r.key]: v }, { shouldDirty: true })}>
                    <SelectTrigger className="w-48" aria-label={`Move leads from ${r.label} to`}><SelectValue placeholder="Choose a status" /></SelectTrigger>
                    <SelectContent>
                      {targets.map((t) => <SelectItem key={t.key} value={t.key!}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Statuses you&apos;ve just added can be picked after saving. Each moved lead gets a note in its history.</p>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-2 border-t">
          <Button type="button" variant="outline" size="sm" disabled={fields.length >= 30}
            onClick={() => {
              // New statuses go just before "Converted" so the pipeline stays in order.
              const at = rows.findIndex((r) => r.key === CONVERTED_STATUS);
              insert(at >= 0 ? at : fields.length, { key: "", label: "", tone: "info", closed: false }, { shouldFocus: true });
            }}>
            <Plus className="size-4" /> Add status
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={!form.formState.isDirty || form.formState.isSubmitting}
              onClick={() => form.reset({ statuses, remap: {} })}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : null} Save statuses
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

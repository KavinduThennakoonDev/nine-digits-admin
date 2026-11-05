"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TextField } from "@/components/forms/text-field";
import { DateTimeField } from "@/components/forms/datetime-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { addClientActivityAction } from "../actions";
import { CLIENT_LOG_TYPES, clientActivitySchema } from "../schemas";

const LABELS: Record<(typeof CLIENT_LOG_TYPES)[number], string> = {
  note: "Note", call: "Call", email: "Email", whatsapp: "WhatsApp", meeting: "Meeting",
};

export function ClientActivityComposer({ clientId }: { clientId: string }) {
  const form = useForm({
    resolver: zodResolver(clientActivitySchema),
    defaultValues: { clientId, type: "note" as const, body: "", occurredAt: "" },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await addClientActivityAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("Added to the timeline.");
    form.reset({ clientId, type: values.type, body: "", occurredAt: "" });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <ToggleGroup type="single" variant="outline" size="sm" value={type}
        onValueChange={(v) => v && form.setValue("type", v as typeof type)}>
        {CLIENT_LOG_TYPES.map((t) => <ToggleGroupItem key={t} value={t} className="px-2.5 text-xs">{LABELS[t]}</ToggleGroupItem>)}
      </ToggleGroup>
      <FieldGroup className="gap-3">
        <TextField control={form.control} name="body" label={type === "note" ? "Note" : "What happened?"} multiline
          placeholder={type === "call" ? "Discussed next month's content calendar…" : "Write a note…"} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DateTimeField control={form.control} name="occurredAt" label="When (leave empty for now)" className="sm:max-w-64" />
          <Button type="submit" className="sm:ml-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null} Add to timeline
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { DateTimeField } from "@/components/forms/datetime-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { CALL_OUTCOME_OPTIONS, LEAD_STATUS_OPTIONS, LOGGABLE_ACTIVITY_OPTIONS, type LeadStatus } from "@/lib/constants";
import { logLeadActivityAction } from "../actions";
import { logActivitySchema, type LogActivityInput } from "../schemas";

const FOLLOW_UP_OPTIONS = [
  { value: "keep", label: "Keep current" },
  { value: "set", label: "Schedule a follow-up" },
  { value: "clear", label: "No follow-up needed" },
];

export function LeadActivityLogger({ leadId, status, hasFollowUp }: { leadId: string; status: LeadStatus; hasFollowUp: boolean }) {
  const blank: LogActivityInput = {
    leadId, type: "call", occurredAt: "", outcome: "", durationMin: "", notes: "", newStatus: "", followUp: "keep", nextFollowUpAt: "",
  };
  const form = useForm({ resolver: zodResolver(logActivitySchema), defaultValues: blank });
  const type = useWatch({ control: form.control, name: "type" });
  const followUp = useWatch({ control: form.control, name: "followUp" });
  const converted = status === "converted";

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await logLeadActivityAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("Activity logged.");
    form.reset({ ...blank, type: values.type });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border bg-muted/30 p-3">
      <ToggleGroup type="single" variant="outline" size="sm" value={type}
        onValueChange={(v) => v && form.setValue("type", v as LogActivityInput["type"] & string)}>
        {LOGGABLE_ACTIVITY_OPTIONS.map((o) => <ToggleGroupItem key={o.value} value={o.value} className="px-2.5 text-xs">{o.label}</ToggleGroupItem>)}
      </ToggleGroup>
      <FieldGroup className="gap-4">
        {type === "call" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="outcome" label="Outcome" options={CALL_OUTCOME_OPTIONS} placeholder="How did it go?" required />
            <TextField control={form.control} name="durationMin" label="Duration (minutes)" inputClassName="tabular" placeholder="e.g. 5" />
          </div>
        ) : null}
        <TextField control={form.control} name="notes" label={type === "note" ? "Note" : "Notes"} multiline required={type === "note"}
          placeholder={type === "call" ? "What did you discuss? Any objections or next steps?" : "Details…"} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField control={form.control} name="occurredAt" label="When" description="Leave empty for right now." />
          {!converted ? (
            <SelectField control={form.control} name="newStatus" label="Update status" allowNone noneLabel="Keep current status"
              options={LEAD_STATUS_OPTIONS.filter((o) => o.value !== "converted" && o.value !== status)} placeholder="Keep current status" />
          ) : null}
        </div>
        {!converted ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="followUp" label="Follow-up"
              options={hasFollowUp ? FOLLOW_UP_OPTIONS : FOLLOW_UP_OPTIONS.filter((o) => o.value !== "clear")} />
            {followUp === "set" ? <DateTimeField control={form.control} name="nextFollowUpAt" label="Follow up on" required /> : null}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null} Log {LOGGABLE_ACTIVITY_OPTIONS.find((o) => o.value === type)?.label.toLowerCase()}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

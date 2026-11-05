"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { ComboboxField } from "@/components/forms/combobox-field";
import { DateField } from "@/components/forms/date-field";
import { DateTimeField } from "@/components/forms/datetime-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import type { ComboOption } from "@/components/forms/combobox";
import { useCan } from "@/components/providers/session-provider";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";
import { saveLeadAction } from "../actions";
import { leadSchema, type LeadInput } from "../schemas";

export type LeadFormOptions = { users: ComboOption[]; services: ComboOption[] };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function LeadFormSheet({
  open, onOpenChange, initial, options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LeadInput | null;
  options: LeadFormOptions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit lead" : "New lead"}</SheetTitle>
          <SheetDescription>{initial?.id ? "Update this lead's details." : "Capture a new enquiry."}</SheetDescription>
        </SheetHeader>
        {open ? <LeadForm key={initial?.id ?? "new"} initial={initial ?? null} options={options} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function LeadForm({ initial, options, onDone }: { initial: LeadInput | null; options: LeadFormOptions; onDone: () => void }) {
  const router = useRouter();
  const can = useCan();
  const isEdit = !!initial?.id;
  const converted = initial?.status === "converted";
  const statusOptions = converted ? LEAD_STATUS_OPTIONS : LEAD_STATUS_OPTIONS.filter((o) => o.value !== "converted");
  const countryOptions = useMemo(() => {
    const c = initial?.country;
    return (c && !COUNTRIES.includes(c) ? [c, ...COUNTRIES] : COUNTRIES).map((x) => ({ value: x, label: x }));
  }, [initial?.country]);

  const form = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: initial ?? {
      fullName: "", email: "", phone: "", whatsapp: "", country: "Sri Lanka", company: "", interestedServiceId: "",
      source: "facebook", status: "new", assignedTo: "", leadDate: today(), nextFollowUpAt: "", notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveLeadAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(isEdit ? "Lead updated." : "Lead added.");
    onDone();
    if (!isEdit) router.push(`/leads/${result.data.id}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto p-4">
        <FieldSet>
          <FieldLegend>Person</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="fullName" label="Full name" required className="sm:col-span-2" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" placeholder="+94 77 123 4567" />
            <TextField control={form.control} name="whatsapp" label="WhatsApp" type="tel" placeholder="+94 77 123 4567" />
            <TextField control={form.control} name="email" label="Email" type="email" />
            <TextField control={form.control} name="company" label="Company" />
            <ComboboxField control={form.control} name="country" label="Country" options={countryOptions} searchPlaceholder="Search countries…" />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Enquiry</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="source" label="Lead source" options={LEAD_SOURCE_OPTIONS} />
            <SelectField control={form.control} name="status" label="Status" options={statusOptions} disabled={converted}
              description={converted ? "Converted leads keep their status." : undefined} />
            <ComboboxField control={form.control} name="interestedServiceId" label="Interested in" options={options.services}
              placeholder="Select a service" className="sm:col-span-2" />
            <DateField control={form.control} name="leadDate" label="Lead date" required />
            {can("leads.assign") ? (
              <ComboboxField control={form.control} name="assignedTo" label="Assigned to" options={options.users}
                placeholder={can("leads.view_all") ? "Unassigned" : "Me"} searchPlaceholder="Search team…" />
            ) : null}
            <DateTimeField control={form.control} name="nextFollowUpAt" label="Next follow-up" className="sm:col-span-2"
              description="You'll see overdue follow-ups highlighted on the leads list and dashboard." />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Notes</FieldLegend>
          <TextField control={form.control} name="notes" label="Notes" multiline inputClassName="min-h-24"
            placeholder="Budget, timeline, what they asked about…" />
        </FieldSet>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {isEdit ? "Save changes" : "Add lead"}
        </Button>
      </SheetFooter>
    </form>
  );
}

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
import { MultiSelectField } from "@/components/forms/multi-select-field";
import { DateField } from "@/components/forms/date-field";
import { MoneyField } from "@/components/forms/money-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import type { ComboOption } from "@/components/forms/combobox";
import { useCan } from "@/components/providers/session-provider";
import { CLIENT_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";
import { saveClientAction } from "../actions";
import { clientSchema, type ClientInput } from "../schemas";

export type ClientFormOptions = { users: ComboOption[]; services: ComboOption[] };

const EMPTY: ClientInput = {
  clientName: "", companyName: "", contactPerson: "", email: "", phone: "", whatsapp: "", address: "", country: "Sri Lanka",
  industry: "", clientType: "retainer", status: "onboarding", assignedTo: "", serviceIds: [], contractStart: "", contractEnd: "",
  retainer: "", retainerCurrency: "LKR", notes: "",
};

export function ClientFormSheet({
  open, onOpenChange, initial, options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ClientInput | null;
  options: ClientFormOptions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit client" : "New client"}</SheetTitle>
          <SheetDescription>{initial?.id ? "Update this client's details." : "Add a client you're working with."}</SheetDescription>
        </SheetHeader>
        {open ? <ClientForm key={initial?.id ?? "new"} initial={initial ?? EMPTY} options={options} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ClientForm({ initial, options, onDone }: { initial: ClientInput; options: ClientFormOptions; onDone: () => void }) {
  const router = useRouter();
  const can = useCan();
  const canAssign = can("clients.view_all");
  const countryOptions = useMemo(() => {
    const list = initial.country && !COUNTRIES.includes(initial.country) ? [initial.country, ...COUNTRIES] : COUNTRIES;
    return list.map((c) => ({ value: c, label: c }));
  }, [initial.country]);

  const form = useForm({ resolver: zodResolver(clientSchema), defaultValues: initial });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveClientAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(initial.id ? "Client updated." : "Client created.");
    onDone();
    if (!initial.id) router.push(`/clients/${result.data.id}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto p-4">
        <FieldSet>
          <FieldLegend>Client</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="clientName" label="Client name" required className="sm:col-span-2" />
            <TextField control={form.control} name="companyName" label="Company" />
            <TextField control={form.control} name="industry" label="Industry" placeholder="e.g. Hospitality" />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Contact</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="contactPerson" label="Contact person" />
            <TextField control={form.control} name="email" label="Email" type="email" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" placeholder="+94 77 123 4567" />
            <TextField control={form.control} name="whatsapp" label="WhatsApp" type="tel" placeholder="+94 77 123 4567" />
            <ComboboxField control={form.control} name="country" label="Country" options={countryOptions} searchPlaceholder="Search countries…" />
            <TextField control={form.control} name="address" label="Address" />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Engagement</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="status" label="Status" options={CLIENT_STATUS_OPTIONS} />
            <SelectField control={form.control} name="clientType" label="Client type" options={CLIENT_TYPE_OPTIONS} />
            {canAssign ? (
              <ComboboxField control={form.control} name="assignedTo" label="Account manager" options={options.users}
                placeholder="Unassigned" searchPlaceholder="Search team…" className="sm:col-span-2" />
            ) : null}
            <MultiSelectField control={form.control} name="serviceIds" label="Services" options={options.services}
              placeholder="Select services" className="sm:col-span-2" />
            <DateField control={form.control} name="contractStart" label="Contract start" />
            <DateField control={form.control} name="contractEnd" label="Contract end" />
            <MoneyField control={form.control} amountName="retainer" currencyName="retainerCurrency" label="Monthly retainer" />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Notes</FieldLegend>
          <TextField control={form.control} name="notes" label="Internal notes" multiline inputClassName="min-h-24" />
        </FieldSet>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {initial.id ? "Save changes" : "Create client"}
        </Button>
      </SheetFooter>
    </form>
  );
}

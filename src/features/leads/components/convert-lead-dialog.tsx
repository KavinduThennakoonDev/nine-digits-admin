"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { ComboboxField } from "@/components/forms/combobox-field";
import { MultiSelectField } from "@/components/forms/multi-select-field";
import { DateField } from "@/components/forms/date-field";
import { MoneyField } from "@/components/forms/money-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { useCan } from "@/components/providers/session-provider";
import { CLIENT_STATUS_OPTIONS, CLIENT_TYPE_OPTIONS } from "@/lib/constants";
import { convertLeadAction } from "../actions";
import { convertLeadSchema } from "../schemas";
import type { LeadFormOptions } from "./lead-form-sheet";

export type ConvertSource = { id: string; fullName: string; company: string; serviceId: string; assignedTo: string };

export function ConvertLeadDialog({
  lead, open, onOpenChange, options,
}: {
  lead: ConvertSource;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  options: LeadFormOptions;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Convert to client</DialogTitle>
          <DialogDescription>
            Creates a client from {lead.fullName}&apos;s details. The lead and its full call history are kept and linked to the new client.
          </DialogDescription>
        </DialogHeader>
        {open ? <ConvertForm lead={lead} options={options} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConvertForm({ lead, options, onDone }: { lead: ConvertSource; options: LeadFormOptions; onDone: () => void }) {
  const router = useRouter();
  const can = useCan();
  const form = useForm({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      leadId: lead.id, clientName: lead.company || lead.fullName, companyName: lead.company, clientType: "retainer" as const,
      status: "onboarding" as const, assignedTo: lead.assignedTo, serviceIds: lead.serviceId ? [lead.serviceId] : [],
      contractStart: "", retainer: "", retainerCurrency: "LKR" as const,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await convertLeadAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("Lead converted. Welcome aboard!");
    onDone();
    router.push(`/clients/${result.data.clientId}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="clientName" label="Client name" required />
          <TextField control={form.control} name="companyName" label="Company" />
          <SelectField control={form.control} name="clientType" label="Client type" options={CLIENT_TYPE_OPTIONS} />
          <SelectField control={form.control} name="status" label="Client status" options={CLIENT_STATUS_OPTIONS} />
          {can("clients.view_all") ? (
            <ComboboxField control={form.control} name="assignedTo" label="Account manager" options={options.users}
              placeholder="Unassigned" className="sm:col-span-2" />
          ) : null}
          <MultiSelectField control={form.control} name="serviceIds" label="Services" options={options.services} className="sm:col-span-2" />
          <DateField control={form.control} name="contractStart" label="Contract start" />
          <MoneyField control={form.control} amountName="retainer" currencyName="retainerCurrency" label="Monthly retainer" />
        </FieldGroup>
      </div>
      <DialogFooter className="border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Convert to client
        </Button>
      </DialogFooter>
    </form>
  );
}

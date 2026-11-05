"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { MoneyField } from "@/components/forms/money-field";
import { SwitchField } from "@/components/forms/switch-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { SERVICE_BILLING_OPTIONS } from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { saveServiceAction } from "../actions";
import { serviceSchema } from "../schemas";
import type { ServiceRow } from "../queries";

export function ServiceSheet({ open, service, onOpenChange }: { open: boolean; service: ServiceRow | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{service ? "Edit service" : "New service"}</SheetTitle>
          <SheetDescription>Services can be assigned to clients and chosen as a lead&apos;s interest.</SheetDescription>
        </SheetHeader>
        {open ? <ServiceForm key={service?.id ?? "new"} service={service} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ServiceForm({ service, onDone }: { service: ServiceRow | null; onDone: () => void }) {
  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      id: service?.id,
      name: service?.name ?? "",
      category: service?.category ?? "",
      description: service?.description ?? "",
      billing: service?.billing ?? "monthly",
      price: service ? minorToAmount(service.priceMinor) : "",
      currency: service?.currency ?? "LKR",
      isActive: service?.isActive ?? true,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveServiceAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(service ? "Service updated." : "Service created.");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <TextField control={form.control} name="name" label="Name" required placeholder="e.g. Social Media Management" />
          <TextField control={form.control} name="category" label="Category" placeholder="e.g. Marketing, Design, Development" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="billing" label="Billing" options={SERVICE_BILLING_OPTIONS} />
            <MoneyField control={form.control} amountName="price" currencyName="currency" label="Base price" />
          </div>
          <TextField control={form.control} name="description" label="Description" multiline />
          <SwitchField control={form.control} name="isActive" label="Active" description="Inactive services can't be picked for new clients or leads." />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {service ? "Save changes" : "Create service"}
        </Button>
      </SheetFooter>
    </form>
  );
}

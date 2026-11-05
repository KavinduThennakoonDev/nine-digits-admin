"use client";

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
import { PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS } from "@/lib/constants";
import { saveProjectAction } from "../actions";
import { projectSchema, type ProjectInput } from "../schemas";

export type ProjectFormOptions = { clients: ComboOption[]; services: ComboOption[]; users: ComboOption[] };

const EMPTY: ProjectInput = {
  name: "", clientId: "", serviceIds: [], budget: "", budgetCurrency: "LKR", startDate: "", deadline: "", managerId: "",
  memberIds: [], status: "planning", priority: "medium", description: "",
};

export function ProjectFormSheet({ open, onOpenChange, initial, options }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: ProjectInput | null; options: ProjectFormOptions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit project" : "New project"}</SheetTitle>
          <SheetDescription>{initial?.id ? "Update the project's details and team." : "Plan a piece of work for a client."}</SheetDescription>
        </SheetHeader>
        {open ? <ProjectForm key={initial?.id ?? "new"} initial={initial ?? EMPTY} options={options} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ProjectForm({ initial, options, onDone }: { initial: ProjectInput; options: ProjectFormOptions; onDone: () => void }) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(projectSchema), defaultValues: initial });
  const onSubmit = form.handleSubmit(async (values) => {
    const r = await saveProjectAction(values);
    if (!r.ok) return applyActionError(form, r.error);
    toast.success(initial.id ? "Project updated." : "Project created.");
    onDone();
    if (!initial.id) router.push(`/projects/${r.data.id}`);
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto p-4">
        <FieldSet>
          <FieldLegend>Project</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Project name" required className="sm:col-span-2" placeholder="e.g. Website redesign" />
            <ComboboxField control={form.control} name="clientId" label="Client" options={options.clients} placeholder="Internal / no client" searchPlaceholder="Search clients…" className="sm:col-span-2" />
            <MultiSelectField control={form.control} name="serviceIds" label="Services" options={options.services} className="sm:col-span-2" />
            <SelectField control={form.control} name="status" label="Status" options={PROJECT_STATUS_OPTIONS} />
            <SelectField control={form.control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />
            <DateField control={form.control} name="startDate" label="Start date" />
            <DateField control={form.control} name="deadline" label="Deadline" />
            <MoneyField control={form.control} amountName="budget" currencyName="budgetCurrency" label="Budget" description="Compared against expenses linked to this project." />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Team</FieldLegend>
          <FieldGroup>
            <ComboboxField control={form.control} name="managerId" label="Project manager" options={options.users} placeholder="No manager" searchPlaceholder="Search team…" />
            <MultiSelectField control={form.control} name="memberIds" label="Team members" options={options.users} placeholder="Add people" />
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Notes</FieldLegend>
          <TextField control={form.control} name="description" label="Description & scope" multiline inputClassName="min-h-24" />
        </FieldSet>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Spinner /> : null} {initial.id ? "Save changes" : "Create project"}</Button>
      </SheetFooter>
    </form>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxField } from "@/components/forms/combobox-field";
import { SelectField } from "@/components/forms/select-field";
import { DateField } from "@/components/forms/date-field";
import { MoneyField } from "@/components/forms/money-field";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import type { ComboOption } from "@/components/forms/combobox";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { saveExpenseAction } from "../actions";
import { expenseSchema, type ExpenseInput } from "../schemas";

export type ExpenseFormOptions = { categories: (ComboOption & { active: boolean })[]; clients: ComboOption[]; projects?: ComboOption[] };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ExpenseSheet({
  open, onOpenChange, initial, presetClientId, options,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: ExpenseInput | null;
  presetClientId?: string;
  options: ExpenseFormOptions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit expense" : "Record expense"}</SheetTitle>
          <SheetDescription>Money the agency spent. Link a client to see it on their profile.</SheetDescription>
        </SheetHeader>
        {open ? <ExpenseForm key={initial?.id ?? "new"} initial={initial ?? null} presetClientId={presetClientId} options={options} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ExpenseForm({ initial, presetClientId, options, onDone }: { initial: ExpenseInput | null; presetClientId?: string; options: ExpenseFormOptions; onDone: () => void }) {
  const form = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: initial ?? {
      name: "", categoryId: "", amount: "", currency: "LKR", expenseDate: today(), method: "bank_transfer",
      clientId: presetClientId ?? "", projectId: "", description: "", receiptRef: "",
    },
  });
  // Inactive categories can't be chosen, but an existing expense keeps showing its own.
  const categoryOptions = options.categories.filter((c) => c.active || c.value === initial?.categoryId);
  const onSubmit = form.handleSubmit(async (values) => {
    const r = await saveExpenseAction(values);
    if (!r.ok) return applyActionError(form, r.error);
    toast.success(initial?.id ? "Expense updated." : "Expense recorded.");
    onDone();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <TextField control={form.control} name="name" label="Expense" required placeholder="e.g. Canva Pro subscription" />
          <ComboboxField control={form.control} name="categoryId" label="Category" options={categoryOptions} required
            placeholder="Select a category" searchPlaceholder="Search categories…" />
          <MoneyField control={form.control} amountName="amount" currencyName="currency" label="Amount" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="expenseDate" label="Date" required />
            <SelectField control={form.control} name="method" label="Paid by" options={PAYMENT_METHOD_OPTIONS} />
          </div>
          <ComboboxField control={form.control} name="clientId" label="Related client" options={options.clients}
            placeholder="Not client-specific" searchPlaceholder="Search clients…" />
          {options.projects?.length ? (
            <ComboboxField control={form.control} name="projectId" label="Related project" options={options.projects}
              placeholder="Not project-specific" searchPlaceholder="Search projects…" />
          ) : null}
          <TextField control={form.control} name="receiptRef" label="Receipt link or reference"
            placeholder="https://drive.google.com/… or receipt #" description="Paste a link to the receipt (e.g. Google Drive) or its number." />
          <TextField control={form.control} name="description" label="Notes" multiline />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {initial?.id ? "Save changes" : "Record expense"}
        </Button>
      </SheetFooter>
    </form>
  );
}

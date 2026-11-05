"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { PAYMENT_METHOD_OPTIONS, type Currency } from "@/lib/constants";
import { minorToAmount } from "@/lib/fields";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { savePaymentAction } from "../actions";
import { paymentSchema, type PaymentInput } from "../schemas";

export type OpenInvoice = { id: string; number: string; clientId: string; currency: Currency; balance: number; dueDate: string };
export type PaymentFormOptions = { clients: (ComboOption & { currency: Currency })[]; openInvoices: OpenInvoice[] };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PaymentSheet({
  open, onOpenChange, initial, preset, options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing payment to edit. */
  initial?: PaymentInput | null;
  /** Prefill a new payment (e.g. from an invoice or client page). */
  preset?: { clientId?: string; invoiceId?: string };
  options: PaymentFormOptions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit payment" : "Record payment"}</SheetTitle>
          <SheetDescription>
            {initial?.id ? "Changes update the linked invoice's balance." : "Money received from a client, against an invoice or as standalone income."}
          </SheetDescription>
        </SheetHeader>
        {open ? <PaymentForm key={initial?.id ?? `new-${preset?.invoiceId ?? preset?.clientId ?? ""}`} initial={initial ?? null} preset={preset} options={options} onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function PaymentForm({
  initial, preset, options, onDone,
}: {
  initial: PaymentInput | null;
  preset?: { clientId?: string; invoiceId?: string };
  options: PaymentFormOptions;
  onDone: () => void;
}) {
  const presetInvoice = options.openInvoices.find((i) => i.id === preset?.invoiceId);
  const form = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: initial ?? {
      clientId: presetInvoice?.clientId ?? preset?.clientId ?? "",
      invoiceId: presetInvoice?.id ?? "",
      amount: presetInvoice ? minorToAmount(presetInvoice.balance) : "",
      currency: presetInvoice?.currency ?? options.clients.find((c) => c.value === preset?.clientId)?.currency ?? "LKR",
      paymentDate: today(),
      method: "bank_transfer",
      reference: "",
      description: "",
      status: "completed",
    },
  });
  const clientId = useWatch({ control: form.control, name: "clientId" });
  const invoiceId = useWatch({ control: form.control, name: "invoiceId" });

  // An edited payment's own invoice may be fully paid, so keep it in the list.
  const invoiceOptions = useMemo(
    () => options.openInvoices
      .filter((i) => i.clientId === clientId && (i.balance > 0 || i.id === initial?.invoiceId))
      .map((i) => ({ value: i.id, label: i.number, hint: `${formatMoney(i.balance, i.currency)} due ${formatDay(i.dueDate)}` })),
    [options.openInvoices, clientId, initial?.invoiceId],
  );

  // Keep invoice/currency consistent with the chosen client and invoice.
  useEffect(() => {
    const inv = options.openInvoices.find((i) => i.id === form.getValues("invoiceId"));
    if (inv && inv.clientId !== clientId) form.setValue("invoiceId", "");
  }, [clientId, form, options.openInvoices]);
  useEffect(() => {
    const inv = options.openInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    form.setValue("currency", inv.currency);
    if (!form.getValues("amount")) form.setValue("amount", minorToAmount(inv.balance));
  }, [invoiceId, form, options.openInvoices]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await savePaymentAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(initial?.id ? "Payment updated." : "Payment recorded.");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <ComboboxField control={form.control} name="clientId" label="Client" options={options.clients} required
            placeholder="Select a client" searchPlaceholder="Search clients…" />
          <ComboboxField control={form.control} name="invoiceId" label="Invoice" options={invoiceOptions}
            placeholder={clientId ? (invoiceOptions.length ? "Not linked to an invoice" : "No open invoices") : "Pick a client first"}
            description="Linking a payment updates that invoice's balance and status." disabled={!clientId} />
          <MoneyField control={form.control} amountName="amount" currencyName="currency" label="Amount received" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="paymentDate" label="Payment date" required />
            <SelectField control={form.control} name="method" label="Method" options={PAYMENT_METHOD_OPTIONS} />
          </div>
          <SelectField control={form.control} name="status" label="Status" options={[
            { value: "completed", label: "Completed — money received" },
            { value: "pending", label: "Pending — awaiting clearance" },
            { value: "failed", label: "Failed — bounced or declined" },
          ]} description="Only completed payments count towards revenue and invoice balances." />
          <TextField control={form.control} name="reference" label="Transaction reference" placeholder="Bank ref, cheque no., gateway ID…" />
          <TextField control={form.control} name="description" label="Description" multiline />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {initial?.id ? "Save changes" : "Record payment"}
        </Button>
      </SheetFooter>
    </form>
  );
}

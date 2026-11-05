"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Combobox, type ComboOption } from "@/components/forms/combobox";
import { ComboboxField } from "@/components/forms/combobox-field";
import { SelectField } from "@/components/forms/select-field";
import { DateField } from "@/components/forms/date-field";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { CURRENCIES, type Currency } from "@/lib/constants";
import { amountToMinor, minorToAmount } from "@/lib/fields";
import { computeTotals } from "@/lib/invoice-math";
import { formatMoney } from "@/lib/money";
import { saveInvoiceAction } from "../actions";
import { invoiceSchema, type InvoiceInput } from "../schemas";

export type PricedService = { value: string; label: string; description: string; price: number; currency: Currency };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function InvoiceEditor({
  initial, meta, clients, services, defaultDueDays, defaultTerms,
}: {
  initial: InvoiceInput | null;
  meta: { number?: string; status?: string; hasPayments: boolean };
  clients: (ComboOption & { currency: Currency })[];
  services: PricedService[];
  defaultDueDays: number;
  defaultTerms: string;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const locked = meta.hasPayments;

  const defaults = useMemo<InvoiceInput>(() => {
    const today = new Date();
    const due = new Date(today.getTime() + defaultDueDays * 86_400_000);
    if (initial) return { ...initial, issueDate: initial.issueDate || isoDay(today), dueDate: initial.dueDate || isoDay(due) };
    return {
      clientId: "", currency: "LKR", issueDate: isoDay(today), dueDate: isoDay(due),
      lineItems: [{ serviceId: "", description: "", quantity: "1", unitPrice: "" }],
      discount: "", taxRate: "", notes: "", terms: defaultTerms, send: false,
    };
  }, [initial, defaultDueDays, defaultTerms]);

  const form = useForm({ resolver: zodResolver(invoiceSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
  const lines = useWatch({ control: form.control, name: "lineItems" });
  const currency = useWatch({ control: form.control, name: "currency" }) as Currency;
  const discount = useWatch({ control: form.control, name: "discount" });
  const taxRate = useWatch({ control: form.control, name: "taxRate" });
  const clientId = useWatch({ control: form.control, name: "clientId" });

  // New invoices follow the chosen client's usual (retainer) currency.
  const lastClient = useRef(clientId);
  useEffect(() => {
    if (isEdit || clientId === lastClient.current) return;
    lastClient.current = clientId;
    const c = clients.find((x) => x.value === clientId);
    if (c) form.setValue("currency", c.currency);
  }, [clientId, clients, form, isEdit]);

  const totals = computeTotals(
    (lines ?? []).map((l) => ({ quantity: Number(l?.quantity) || 0, unitPrice: amountToMinor(l?.unitPrice || "") ?? 0 })),
    amountToMinor(discount || "") ?? 0,
    Number(taxRate) || 0,
  );

  const addService = (id: string) => {
    const s = services.find((x) => x.value === id);
    if (!s) return;
    append({
      serviceId: s.value,
      description: s.description ? `${s.label} — ${s.description}` : s.label,
      quantity: "1",
      // Only prefill the price when the service is priced in the invoice currency.
      unitPrice: s.price && s.currency === currency ? minorToAmount(s.price) : "",
    });
  };

  const submit = (send: boolean) =>
    form.handleSubmit(async (values) => {
      const result = await saveInvoiceAction({ ...values, send });
      if (!result.ok) return applyActionError(form, result.error);
      toast.success(isEdit ? "Invoice saved." : send ? "Invoice issued." : "Draft saved.");
      router.push(`/finance/invoices/${result.data.id}`);
    });

  const { isSubmitting, errors } = form.formState;
  const lineErrors = errors.lineItems;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {locked ? (
          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>This invoice has payments recorded, so amounts, client and currency are locked. You can still change the due date, notes and terms.</p>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Bill to</CardTitle>
            <CardDescription>{meta.number ? `Invoice ${meta.number}` : "The number is assigned when you save."}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <ComboboxField control={form.control} name="clientId" label="Client" options={clients} required
                placeholder="Select a client" searchPlaceholder="Search clients…" className="sm:col-span-2" disabled={locked} />
              <SelectField control={form.control} name="currency" label="Currency" disabled={locked}
                options={CURRENCIES.map((c) => ({ value: c, label: c === "LKR" ? "LKR · Sri Lankan Rupee" : "USD · US Dollar" }))} />
              <div className="hidden sm:block" />
              <DateField control={form.control} name="issueDate" label="Issue date" required />
              <DateField control={form.control} name="dueDate" label="Due date" required />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden grid-cols-[1fr_5rem_9rem_8rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Amount</span><span />
            </div>
            {fields.map((f, i) => {
              const err = Array.isArray(lineErrors) ? lineErrors[i] : undefined;
              const line = lines?.[i];
              const amount = Math.round((Number(line?.quantity) || 0) * (amountToMinor(line?.unitPrice || "") ?? 0));
              return (
                <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_5rem_9rem_8rem_2rem] sm:items-start sm:rounded-none sm:border-0 sm:p-0">
                  <div className="col-span-2 sm:col-span-1">
                    <Input placeholder="e.g. Social media management — November" aria-label={`Line ${i + 1} description`}
                      aria-invalid={!!err?.description} disabled={locked} {...form.register(`lineItems.${i}.description`)} />
                    <FieldError errors={[err?.description]} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Input inputMode="decimal" className="tabular" aria-label={`Line ${i + 1} quantity`} aria-invalid={!!err?.quantity}
                      disabled={locked} {...form.register(`lineItems.${i}.quantity`)} />
                    <FieldError errors={[err?.quantity]} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Input inputMode="decimal" placeholder="0.00" className="tabular" aria-label={`Line ${i + 1} unit price`}
                      aria-invalid={!!err?.unitPrice} disabled={locked} {...form.register(`lineItems.${i}.unitPrice`)} />
                    <FieldError errors={[err?.unitPrice]} className="mt-1 text-xs" />
                  </div>
                  <p className="tabular self-center text-right text-sm sm:pt-1.5">{formatMoney(amount, currency)}</p>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`}
                    disabled={locked || fields.length === 1} onClick={() => remove(i)} className="justify-self-end">
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            {!Array.isArray(lineErrors) && lineErrors?.message ? <FieldError>{lineErrors.message}</FieldError> : null}
            {!locked ? (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => append({ serviceId: "", description: "", quantity: "1", unitPrice: "" })}>
                  <Plus /> Add line
                </Button>
                {services.length ? (
                  <div className="sm:w-72">
                    <Combobox value="" onChange={addService} placeholder="Add a service…" ariaLabel="Add a service" searchPlaceholder="Search services…"
                      options={services.map((s) => ({ value: s.value, label: s.label, hint: s.price ? formatMoney(s.price, s.currency) : undefined }))}
                      className="h-7 text-[0.8rem]" clearable={false} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes & terms</CardTitle></CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="notes" label="Notes to the client" multiline placeholder="Thank you for your business!" />
              <TextField control={form.control} name="terms" label="Payment terms" multiline placeholder="Bank details, late fees…" />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-18 lg:self-start">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup className="gap-3">
              <TextField control={form.control} name="discount" label={`Discount (${currency})`} placeholder="0.00" inputClassName="tabular" disabled={locked} />
              <TextField control={form.control} name="taxRate" label="Tax rate (%)" placeholder="0" inputClassName="tabular" disabled={locked} />
            </FieldGroup>
            <dl className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatMoney(totals.subtotal, currency)}</dd></div>
              {totals.discount ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular">−{formatMoney(totals.discount, currency)}</dd></div> : null}
              {totals.taxAmount ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(taxRate) || 0}%)</dt><dd className="tabular">{formatMoney(totals.taxAmount, currency)}</dd></div> : null}
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(totals.total, currency)}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          {!isEdit || meta.status === "draft" ? (
            <>
              <Button type="button" size="lg" disabled={isSubmitting} onClick={submit(true)}>
                {isSubmitting ? <Spinner /> : null} Save & issue invoice
              </Button>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={submit(false)}>Save as draft</Button>
            </>
          ) : (
            <Button type="button" size="lg" disabled={isSubmitting} onClick={submit(false)}>
              {isSubmitting ? <Spinner /> : null} Save changes
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

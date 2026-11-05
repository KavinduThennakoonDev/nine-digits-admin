"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { formatDateTime } from "@/lib/format";
import { updateCurrencyAction } from "../actions";
import { currencySchema } from "../schemas";
import type { AppSettings } from "../queries";

export function CurrencyForm({ settings }: { settings: AppSettings }) {
  const form = useForm({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      base: settings.currency.base,
      usdToLkr: settings.currency.usdToLkr,
      invoicePrefix: settings.invoice.prefix,
      defaultDueDays: settings.invoice.defaultDueDays,
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateCurrencyAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    form.reset(values);
    toast.success("Currency & invoicing settings saved.");
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>Currency & invoicing</CardTitle>
          <CardDescription>
            Amounts are stored in their original currency (LKR or USD). Each record keeps the exchange rate in effect when it was created,
            so changing the rate never alters past figures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="base"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="base">Reporting currency</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="base" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LKR">LKR · Sri Lankan Rupee</SelectItem>
                      <SelectItem value="USD">USD · US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Totals on dashboards and reports are shown in this currency.</FieldDescription>
                </Field>
              )}
            />
            <TextField control={form.control} name="usdToLkr" label="Exchange rate (1 USD = ? LKR)" type="number" inputClassName="tabular" />
            <TextField control={form.control} name="invoicePrefix" label="Invoice number prefix" description="e.g. ND → ND-2026-0001" />
            <TextField control={form.control} name="defaultDueDays" label="Default payment terms (days)" type="number" />
          </FieldGroup>
          {settings.currency.rateHistory.length > 0 ? (
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium">Rate history</h4>
              <ul className="divide-y rounded-lg border text-sm">
                {settings.currency.rateHistory.map((r, i) => (
                  <li key={i} className="flex justify-between px-3 py-2">
                    <span className="tabular">1 USD = {r.usdToLkr.toLocaleString()} LKR</span>
                    <span className="text-muted-foreground">{formatDateTime(r.changedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? <Spinner /> : null} Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

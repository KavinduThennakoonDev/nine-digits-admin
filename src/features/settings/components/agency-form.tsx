"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { updateAgencyAction } from "../actions";
import { agencySchema } from "../schemas";
import type { AppSettings } from "../queries";

export function AgencyForm({ agency }: { agency: AppSettings["agency"] }) {
  const form = useForm({ resolver: zodResolver(agencySchema), defaultValues: agency });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateAgencyAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    form.reset(values);
    toast.success("Agency information saved.");
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>Agency information</CardTitle>
          <CardDescription>Used on invoices, reports and exports.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Display name" required />
            <TextField control={form.control} name="legalName" label="Legal name" />
            <TextField control={form.control} name="email" label="Email" type="email" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <TextField control={form.control} name="website" label="Website" type="url" placeholder="https://" />
            <TextField control={form.control} name="taxId" label="Business reg. / Tax ID" />
            <TextField control={form.control} name="address" label="Address" multiline className="sm:col-span-2" />
            <TextField control={form.control} name="country" label="Country" />
          </FieldGroup>
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

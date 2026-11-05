"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { updateProfileAction } from "../actions";
import { updateProfileSchema } from "../schemas";

export function ProfileForm({ profile }: { profile: { name: string; email: string; phone: string; jobTitle: string } }) {
  const form = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: profile.name, phone: profile.phone, jobTitle: profile.jobTitle },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateProfileAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    form.reset(values);
    toast.success("Profile updated.");
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="name" label="Full name" required />
        <Field>
          <FieldLabel htmlFor="email-ro">Email</FieldLabel>
          <Input id="email-ro" value={profile.email} disabled readOnly />
          <FieldDescription>Ask an administrator to change your sign-in email.</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="jobTitle" label="Job title" />
          <TextField control={form.control} name="phone" label="Phone" type="tel" />
        </div>
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? <Spinner /> : null} Save profile
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

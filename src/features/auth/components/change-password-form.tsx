"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { changePasswordAction } from "../actions";
import { changePasswordSchema } from "../schemas";

export function ChangePasswordForm({ onDone, submitLabel = "Update password" }: { onDone?: () => void; submitLabel?: string }) {
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await changePasswordAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("Password updated. Other devices have been signed out.");
    form.reset();
    onDone?.();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
        <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password"
          description="At least 10 characters, with letters and numbers." />
        <TextField control={form.control} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

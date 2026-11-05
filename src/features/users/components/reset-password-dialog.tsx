"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { resetUserPasswordAction } from "../actions";
import { resetPasswordSchema } from "../schemas";

export function ResetPasswordDialog({ user, onOpenChange }: { user: { id: string; name: string } | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for {user?.name}. They’ll be signed out everywhere and asked to choose a new password at next sign-in.
          </DialogDescription>
        </DialogHeader>
        {user ? <ResetForm key={user.id} id={user.id} name={user.name} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ResetForm({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const form = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { id, password: "", confirmPassword: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await resetUserPasswordAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(`Password reset for ${name}.`);
    onDone();
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField control={form.control} name="password" label="Temporary password" type="text" autoComplete="new-password" />
        <TextField control={form.control} name="confirmPassword" label="Confirm password" type="text" autoComplete="new-password" />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Reset password
        </Button>
      </DialogFooter>
    </form>
  );
}

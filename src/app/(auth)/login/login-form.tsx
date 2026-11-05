"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { applyActionError } from "@/components/forms/apply-action-error";
import { loginAction } from "@/features/auth/actions";
import { loginSchema } from "@/features/auth/schemas";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const uid = useId();
  const ids = { email: `${uid}-email`, password: `${uid}-password`, remember: `${uid}-remember` };
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await loginAction({ ...values, next: new URLSearchParams(window.location.search).get("next") ?? undefined });
    // On success the action redirects; we only get here on failure.
    if (result && !result.ok) {
      applyActionError(form, result.error);
      form.resetField("password", { keepError: true });
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor={ids.email}>Email</FieldLabel>
          <Input
            id={ids.email}
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@ninedigits.lk"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor={ids.password}>Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={ids.password}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError errors={[errors.password]} />
        </Field>
        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox id={ids.remember} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <FieldLabel htmlFor={ids.remember} className="font-normal">
                Keep me signed in for 30 days
              </FieldLabel>
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null}
          Sign in
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Forgot your password? Ask a Super Admin to reset it.
        </p>
      </FieldGroup>
    </form>
  );
}

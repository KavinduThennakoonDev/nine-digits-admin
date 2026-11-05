"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../actions";
import { ChangePasswordForm } from "./change-password-form";

/**
 * Rendered by the protected layout in place of any page while the user still has an
 * admin-set password. The action calls refresh(), so on success the same URL
 * re-renders with fresh server data and the real page appears — no redirects involved.
 */
export function ForcedPasswordChange({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Your password was set by an administrator. Choose your own password to continue.
        </p>
      </div>
      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        Signed in as <span className="font-medium">{email}</span>
      </p>
      <ChangePasswordForm submitLabel="Save and continue" />
      <Button variant="link" className="h-auto px-0 text-muted-foreground" disabled={pending}
        onClick={() => startTransition(() => logoutAction())}>
        Sign out instead
      </Button>
    </div>
  );
}

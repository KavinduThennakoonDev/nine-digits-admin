"use client";

import { toast } from "sonner";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionError } from "@/lib/action-result";

/** Pushes server-side field errors into react-hook-form and toasts the message. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- library generics are invariant
export function applyActionError<T extends FieldValues>(form: UseFormReturn<T, any, any>, error: ActionError) {
  let placed = false;
  for (const [field, messages] of Object.entries(error.fieldErrors ?? {})) {
    if (messages?.[0]) {
      form.setError(field as Path<T>, { type: "server", message: messages[0] }, { shouldFocus: !placed });
      placed = true;
    }
  }
  if (!placed || error.code !== "VALIDATION") toast.error(error.message);
}

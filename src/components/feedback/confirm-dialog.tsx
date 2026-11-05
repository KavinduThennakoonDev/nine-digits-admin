"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Confirmation dialog that awaits an async action and stays open while it runs. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await onConfirm();
                if (result !== false) setOpen(false);
              });
            }}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { refundPaymentAction } from "../actions";
import { refundSchema } from "../schemas";

export function RefundDialog({ payment, onOpenChange }: { payment: { id: string; label: string } | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            {payment?.label}. The payment stays on record as refunded, stops counting as revenue, and the linked invoice&apos;s balance is reopened.
          </DialogDescription>
        </DialogHeader>
        {payment ? <RefundForm id={payment.id} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RefundForm({ id, onDone }: { id: string; onDone: () => void }) {
  const form = useForm({ resolver: zodResolver(refundSchema), defaultValues: { id, reason: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    const r = await refundPaymentAction(values);
    if (!r.ok) return applyActionError(form, r.error);
    toast.success("Payment refunded.");
    onDone();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <TextField control={form.control} name="reason" label="Reason" multiline required placeholder="e.g. Duplicate payment returned to client" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Refund payment
        </Button>
      </DialogFooter>
    </form>
  );
}

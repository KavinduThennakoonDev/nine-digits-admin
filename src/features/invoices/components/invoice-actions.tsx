"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, MoreHorizontal, Pencil, Printer, Send, Trash2, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { useCan } from "@/components/providers/session-provider";
import { PaymentSheet, type PaymentFormOptions } from "@/features/payments/components/payment-sheet";
import type { InvoiceStatus } from "@/lib/constants";
import { deleteDraftInvoiceAction, markInvoiceSentAction, voidInvoiceAction } from "../actions";
import { voidInvoiceSchema } from "../schemas";

export function InvoiceActions({
  id, number, status, balance, hasPayments, paymentOptions,
}: {
  id: string;
  number: string;
  status: InvoiceStatus;
  balance: number;
  hasPayments: boolean;
  paymentOptions: PaymentFormOptions;
}) {
  const can = useCan();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();
  const canManage = can("invoices.manage");
  const canPay = can("payments.manage") && status !== "void" && status !== "paid" && balance > 0;

  return (
    <>
      {canManage && status === "draft" ? (
        <Button disabled={pending} onClick={() => startTransition(async () => {
          const r = await markInvoiceSentAction(id);
          if (r.ok) toast.success(`${number} issued.`); else toast.error(r.error.message);
        })}>{pending ? <Spinner /> : <Send />} Issue invoice</Button>
      ) : null}
      {canPay ? <Button variant={status === "draft" ? "outline" : "default"} onClick={() => setPaying(true)}><Wallet /> Record payment</Button> : null}
      <Button variant="outline" onClick={() => window.print()}><Printer /> Print / PDF</Button>
      {canManage && status !== "void" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/finance/invoices/${id}/edit`}><Pencil /> Edit</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            {status === "draft" ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2 /> Delete draft</DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" disabled={hasPayments} onSelect={() => setVoiding(true)}>
                <Ban /> {hasPayments ? "Void (refund payments first)" : "Void invoice"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <PaymentSheet open={paying} onOpenChange={setPaying} preset={{ invoiceId: id }} options={paymentOptions} />
      <VoidDialog id={id} number={number} open={voiding} onOpenChange={setVoiding} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete draft ${number}?`}
        description="Drafts were never sent, so they can be deleted. Issued invoices are voided instead to keep the record."
        confirmLabel="Delete draft"
        destructive
        onConfirm={async () => {
          const r = await deleteDraftInvoiceAction(id);
          if (r && !r.ok) { toast.error(r.error.message); return false; }
        }}
      />
    </>
  );
}

function VoidDialog({ id, number, open, onOpenChange }: { id: string; number: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {number}?</DialogTitle>
          <DialogDescription>The invoice stays on record as void and no longer counts as owed. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        {open ? <VoidForm id={id} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function VoidForm({ id, onDone }: { id: string; onDone: () => void }) {
  const form = useForm({ resolver: zodResolver(voidInvoiceSchema), defaultValues: { id, reason: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    const r = await voidInvoiceAction(values);
    if (!r.ok) return applyActionError(form, r.error);
    toast.success("Invoice voided.");
    onDone();
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <TextField control={form.control} name="reason" label="Reason" required multiline placeholder="e.g. Issued to the wrong client" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Void invoice
        </Button>
      </DialogFooter>
    </form>
  );
}

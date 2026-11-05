/**
 * Invoice arithmetic in integer minor units — shared by the editor's live
 * preview and the server, so both always agree to the cent.
 */
export type LineInput = { quantity: number; unitPrice: number };

export const lineAmount = (l: LineInput) => Math.round(l.quantity * l.unitPrice);

export function computeTotals(lines: LineInput[], discount: number, taxRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const appliedDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = subtotal - appliedDiscount;
  const taxAmount = Math.round((taxable * taxRate) / 100);
  return { subtotal, discount: appliedDiscount, taxAmount, total: taxable + taxAmount };
}

/** Stored status after payments change. Void and draft-without-payments are left alone. */
export function statusAfterPayments(
  current: "draft" | "sent" | "partial" | "paid" | "void",
  total: number,
  amountPaid: number,
): "draft" | "sent" | "partial" | "paid" | "void" {
  if (current === "void") return "void";
  if (amountPaid <= 0) return current === "draft" ? "draft" : "sent";
  return amountPaid >= total ? "paid" : "partial";
}

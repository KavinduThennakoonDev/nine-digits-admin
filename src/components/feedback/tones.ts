import type { Tone } from "./status-badge";
import type { ClientStatus, InvoiceStatus, LeadStatus, PaymentStatus } from "@/lib/constants";

export const CLIENT_STATUS_TONE: Record<ClientStatus, Tone> = {
  onboarding: "info", active: "success", paused: "warning", inactive: "neutral",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  new: "brand", not_contacted: "neutral", contacted: "info", interested: "info", follow_up: "warning",
  negotiation: "warning", converted: "success", not_interested: "neutral", lost: "danger",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus | "overdue", Tone> = {
  draft: "neutral", sent: "info", partial: "warning", paid: "success", void: "neutral", overdue: "danger",
};
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus | "overdue", string> = {
  draft: "Draft", sent: "Sent", partial: "Partially paid", paid: "Paid", void: "Void", overdue: "Overdue",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  completed: "success", pending: "warning", failed: "danger", refunded: "neutral",
};

import type { Tone } from "./status-badge";
import type { ClientStatus, InvoiceStatus, PaymentStatus, Priority, ProjectStatus, TaskStatus } from "@/lib/constants";

export const CLIENT_STATUS_TONE: Record<ClientStatus, Tone> = {
  onboarding: "info", active: "success", paused: "warning", inactive: "neutral",
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


export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  planning: "neutral", in_progress: "info", on_hold: "warning", completed: "success", cancelled: "neutral",
};
export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  todo: "neutral", in_progress: "info", review: "warning", done: "success", cancelled: "neutral",
};
export const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", medium: "info", high: "warning", urgent: "danger" };

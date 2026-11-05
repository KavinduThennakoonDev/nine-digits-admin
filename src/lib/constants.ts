/** Client-safe enums shared by models, validation and UI. */
export const USER_STATUSES = ["active", "inactive", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CURRENCIES = ["LKR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

type Option<T extends string> = { value: T; label: string };
const opts = <T extends string>(entries: [T, string][]): Option<T>[] => entries.map(([value, label]) => ({ value, label }));
export const labelOf = <T extends string>(options: Option<T>[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? value ?? "—";

/* ── Clients ─────────────────────────────────────────────── */
export const CLIENT_STATUSES = ["onboarding", "active", "paused", "inactive"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_OPTIONS = opts<ClientStatus>([
  ["onboarding", "Onboarding"], ["active", "Active"], ["paused", "Paused"], ["inactive", "Inactive"],
]);

export const CLIENT_TYPES = ["retainer", "project", "one_off"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export const CLIENT_TYPE_OPTIONS = opts<ClientType>([
  ["retainer", "Monthly retainer"], ["project", "Project-based"], ["one_off", "One-off"],
]);

export const CLIENT_ACTIVITY_TYPES = ["note", "call", "email", "whatsapp", "meeting", "status_change", "system"] as const;
export type ClientActivityType = (typeof CLIENT_ACTIVITY_TYPES)[number];

/* ── Leads ───────────────────────────────────────────────── */
export const LEAD_SOURCES = ["facebook", "instagram", "website", "whatsapp", "referral", "google_ads", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_OPTIONS = opts<LeadSource>([
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["website", "Website"], ["whatsapp", "WhatsApp"],
  ["referral", "Referral"], ["google_ads", "Google Ads"], ["other", "Other"],
]);

export const LEAD_STATUSES = [
  "new", "not_contacted", "contacted", "interested", "follow_up", "negotiation", "converted", "not_interested", "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_OPTIONS = opts<LeadStatus>([
  ["new", "New"], ["not_contacted", "Not contacted"], ["contacted", "Contacted"], ["interested", "Interested"],
  ["follow_up", "Follow-up required"], ["negotiation", "Negotiation"], ["converted", "Converted"],
  ["not_interested", "Not interested"], ["lost", "Lost"],
]);
/** Statuses where the lead is finished and no follow-up is expected. */
export const CLOSED_LEAD_STATUSES: LeadStatus[] = ["converted", "not_interested", "lost"];

export const LEAD_ACTIVITY_TYPES = ["call", "whatsapp", "email", "meeting", "note", "status_change", "assignment", "conversion", "system"] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];
/** Types a person can log by hand. */
export const LOGGABLE_ACTIVITY_OPTIONS = opts<"call" | "whatsapp" | "email" | "meeting" | "note">([
  ["call", "Phone call"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["meeting", "Meeting"], ["note", "Note"],
]);

export const CALL_OUTCOMES = ["answered", "no_answer", "busy", "voicemail", "callback_requested", "wrong_number"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export const CALL_OUTCOME_OPTIONS = opts<CallOutcome>([
  ["answered", "Answered"], ["no_answer", "No answer"], ["busy", "Busy"], ["voicemail", "Left voicemail"],
  ["callback_requested", "Asked to call back"], ["wrong_number", "Wrong number"],
]);

export const SERVICE_BILLING = ["monthly", "one_off", "hourly"] as const;
export type ServiceBilling = (typeof SERVICE_BILLING)[number];
export const SERVICE_BILLING_OPTIONS = opts<ServiceBilling>([
  ["monthly", "Monthly"], ["one_off", "One-off"], ["hourly", "Hourly"],
]);

/* ── Finance ─────────────────────────────────────────────── */
/** Stored invoice states. "Overdue" is derived (open + past due date), never stored. */
export const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_OPTIONS = opts<InvoiceStatus>([
  ["draft", "Draft"], ["sent", "Sent"], ["partial", "Partially paid"], ["paid", "Paid"], ["void", "Void"],
]);
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["sent", "partial"];

export const PAYMENT_METHODS = ["bank_transfer", "cash", "card", "cheque", "online", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_OPTIONS = opts<PaymentMethod>([
  ["bank_transfer", "Bank transfer"], ["cash", "Cash"], ["card", "Card"], ["cheque", "Cheque"],
  ["online", "Online gateway"], ["other", "Other"],
]);

/** Only "completed" payments count towards revenue and invoice balances. */
export const PAYMENT_STATUSES = ["completed", "pending", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_OPTIONS = opts<PaymentStatus>([
  ["completed", "Completed"], ["pending", "Pending"], ["failed", "Failed"], ["refunded", "Refunded"],
]);

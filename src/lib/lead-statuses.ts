/** Client-safe lead-status definitions. The live list is stored in Settings and edited by admins. */
import type { Tone } from "@/components/feedback/status-badge";

export const STATUS_TONES = ["neutral", "brand", "info", "success", "warning", "danger"] as const satisfies readonly Tone[];
export const STATUS_TONE_LABELS: Record<Tone, string> = {
  neutral: "Grey", brand: "Brand", info: "Blue", success: "Green", warning: "Amber", danger: "Red",
};

export type LeadStatusDef = {
  key: string;
  label: string;
  tone: Tone;
  /** Finished: no follow-up expected, excluded from "open" counts and reminders. */
  closed: boolean;
};

/** Built-in statuses the app relies on. They can be renamed and recoloured, never removed. */
export const NEW_STATUS = "new";
export const CONVERTED_STATUS = "converted";
export const SYSTEM_LEAD_STATUSES = [NEW_STATUS, CONVERTED_STATUS] as const;
export const isSystemStatus = (key: string) => (SYSTEM_LEAD_STATUSES as readonly string[]).includes(key);

export const DEFAULT_LEAD_STATUSES: LeadStatusDef[] = [
  { key: "new", label: "New", tone: "brand", closed: false },
  { key: "not_contacted", label: "Not contacted", tone: "neutral", closed: false },
  { key: "contacted", label: "Contacted", tone: "info", closed: false },
  { key: "interested", label: "Interested", tone: "info", closed: false },
  { key: "follow_up", label: "Follow-up required", tone: "warning", closed: false },
  { key: "negotiation", label: "Negotiation", tone: "warning", closed: false },
  { key: "converted", label: "Converted", tone: "success", closed: true },
  { key: "not_interested", label: "Not interested", tone: "neutral", closed: true },
  { key: "lost", label: "Lost", tone: "danger", closed: true },
];

/** Normalises a stored list: guarantees the system statuses exist and keeps their invariants. */
export function normaliseLeadStatuses(stored: Partial<LeadStatusDef>[] | null | undefined): LeadStatusDef[] {
  const list: LeadStatusDef[] = (stored?.length ? stored : DEFAULT_LEAD_STATUSES)
    .filter((s): s is LeadStatusDef => !!s.key && !!s.label)
    .map((s) => ({
      key: s.key,
      label: s.label,
      tone: (STATUS_TONES as readonly string[]).includes(s.tone as string) ? (s.tone as Tone) : "neutral",
      closed: s.key === CONVERTED_STATUS ? true : s.key === NEW_STATUS ? false : !!s.closed,
    }));
  for (const key of SYSTEM_LEAD_STATUSES) {
    if (!list.some((s) => s.key === key)) {
      const def = DEFAULT_LEAD_STATUSES.find((d) => d.key === key)!;
      if (key === NEW_STATUS) list.unshift(def); else list.push(def);
    }
  }
  return list;
}

export const closedStatusKeys = (list: LeadStatusDef[]) => list.filter((s) => s.closed).map((s) => s.key);
export const statusLabel = (list: LeadStatusDef[], key: string | null | undefined) =>
  list.find((s) => s.key === key)?.label ?? (key ? key.replace(/_/g, " ") : "—");
export const statusTone = (list: LeadStatusDef[], key: string | null | undefined): Tone =>
  list.find((s) => s.key === key)?.tone ?? "neutral";
/** Statuses a person can pick by hand ("converted" is reached only through conversion). */
export const editableStatuses = (list: LeadStatusDef[]) => list.filter((s) => s.key !== CONVERTED_STATUS);

/** Stable key from a label: "Proposal sent" → "proposal_sent". */
export const statusKeyFrom = (label: string) =>
  label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "status";

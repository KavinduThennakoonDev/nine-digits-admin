"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LEAD_STATUSES, editableStatuses, statusLabel, statusTone, type LeadStatusDef } from "@/lib/lead-statuses";

const LeadStatusContext = createContext<LeadStatusDef[]>(DEFAULT_LEAD_STATUSES);

export function LeadStatusProvider({ statuses, children }: { statuses: LeadStatusDef[]; children: React.ReactNode }) {
  return <LeadStatusContext value={statuses}>{children}</LeadStatusContext>;
}

/** The configured lead pipeline plus lookup helpers. */
export function useLeadStatuses() {
  const statuses = useContext(LeadStatusContext);
  return useMemo(() => ({
    statuses,
    options: statuses.map((s) => ({ value: s.key, label: s.label })),
    editableOptions: editableStatuses(statuses).map((s) => ({ value: s.key, label: s.label })),
    label: (key: string | null | undefined) => statusLabel(statuses, key),
    tone: (key: string | null | undefined) => statusTone(statuses, key),
  }), [statuses]);
}

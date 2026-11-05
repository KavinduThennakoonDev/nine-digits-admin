"use client";

import { StatusBadge } from "@/components/feedback/status-badge";
import { useLeadStatuses } from "@/components/providers/lead-status-provider";

/** Badge for a lead status, using the colours and names configured in Settings. */
export function LeadStatusBadge({ status }: { status: string }) {
  const ls = useLeadStatuses();
  return <StatusBadge tone={ls.tone(status)}>{ls.label(status)}</StatusBadge>;
}

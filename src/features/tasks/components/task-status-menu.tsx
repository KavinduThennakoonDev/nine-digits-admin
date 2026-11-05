"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/feedback/status-badge";
import { TASK_STATUS_TONE } from "@/components/feedback/tones";
import { labelOf, TASK_STATUS_OPTIONS, type TaskStatus } from "@/lib/constants";
import { setTaskStatusAction } from "../actions";

/** Status badge that assignees/managers can click to move the task. */
export function TaskStatusMenu({ id, status, editable, label = "Change status" }: { id: string; status: TaskStatus; editable: boolean; label?: string }) {
  const [pending, startTransition] = useTransition();
  const badge = <StatusBadge tone={TASK_STATUS_TONE[status]}>{labelOf(TASK_STATUS_OPTIONS, status)}</StatusBadge>;
  if (!editable) return badge;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={pending} aria-label={label} onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          {badge}<ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => startTransition(async () => {
          const r = await setTaskStatusAction(id, v);
          if (r.ok) toast.success(`Moved to ${labelOf(TASK_STATUS_OPTIONS, v)}.`); else toast.error(r.error.message);
        })}>
          {TASK_STATUS_OPTIONS.map((o) => <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

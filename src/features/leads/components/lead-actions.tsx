"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ChevronDown, Handshake, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { LEAD_STATUS_TONE } from "@/components/feedback/tones";
import { useCan } from "@/components/providers/session-provider";
import { LEAD_STATUS_OPTIONS, labelOf, type LeadStatus } from "@/lib/constants";
import { deleteLeadAction, setLeadArchivedAction, setLeadStatusAction } from "../actions";
import type { LeadInput } from "../schemas";
import { ConvertLeadDialog, type ConvertSource } from "./convert-lead-dialog";
import { LeadFormSheet, type LeadFormOptions } from "./lead-form-sheet";

/** Status badge that doubles as a quick status switcher. */
export function LeadStatusSwitcher({ id, status }: { id: string; status: LeadStatus }) {
  const can = useCan();
  const [pending, startTransition] = useTransition();
  const badge = <StatusBadge tone={LEAD_STATUS_TONE[status]}>{labelOf(LEAD_STATUS_OPTIONS, status)}</StatusBadge>;
  if (status === "converted" || !can("leads.update")) return badge;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={pending} className="inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" aria-label="Change status">
          {badge}<ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => startTransition(async () => {
          const r = await setLeadStatusAction(id, v);
          if (r.ok) toast.success(`Status set to ${labelOf(LEAD_STATUS_OPTIONS, v)}.`); else toast.error(r.error.message);
        })}>
          {LEAD_STATUS_OPTIONS.filter((o) => o.value !== "converted").map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LeadActions({
  lead, archived, converted, form, options,
}: {
  lead: ConvertSource;
  archived: boolean;
  converted: boolean;
  form: LeadInput;
  options: LeadFormOptions;
}) {
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const canDelete = can("leads.delete");

  return (
    <>
      {!converted && can("leads.convert") && can("clients.create") ? (
        <Button onClick={() => setConverting(true)}><Handshake /> Convert to client</Button>
      ) : null}
      {can("leads.update") ? <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button> : null}
      {canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {archived ? (
              <DropdownMenuItem onSelect={async () => {
                const r = await setLeadArchivedAction(lead.id, false);
                if (r.ok) toast.success("Lead restored."); else toast.error(r.error.message);
              }}><ArchiveRestore /> Restore</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>
            )}
            {!converted ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <LeadFormSheet open={editing} onOpenChange={setEditing} initial={form} options={options} />
      <ConvertLeadDialog lead={lead} open={converting} onOpenChange={setConverting} options={options} />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archive ${lead.fullName}?`}
        description="Archived leads are hidden from lists and follow-up reminders, but keep their full history."
        confirmLabel="Archive"
        onConfirm={async () => {
          const r = await setLeadArchivedAction(lead.id, true);
          if (!r.ok) { toast.error(r.error.message); return false; }
          toast.success("Lead archived.");
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${lead.fullName}?`}
        description="The lead and its activity will be removed from the app. Use Archive to keep it for reference."
        confirmLabel="Delete lead"
        destructive
        onConfirm={async () => {
          const r = await deleteLeadAction(lead.id);
          if (r && !r.ok) { toast.error(r.error.message); return false; }
        }}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useCan } from "@/components/providers/session-provider";
import { deleteClientAction, setClientArchivedAction } from "../actions";
import type { ClientInput } from "../schemas";
import { ClientFormSheet, type ClientFormOptions } from "./client-form-sheet";

export function ClientActions({
  id, name, archived, form, options,
}: {
  id: string;
  name: string;
  archived: boolean;
  form: ClientInput;
  options: ClientFormOptions;
}) {
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const canEdit = can("clients.update");
  const canArchive = can("clients.archive");
  const canDelete = can("clients.delete");

  return (
    <>
      {canEdit ? <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button> : null}
      {canArchive || canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canArchive ? (
              archived ? (
                <DropdownMenuItem onSelect={async () => {
                  const r = await setClientArchivedAction(id, false);
                  if (r.ok) toast.success("Client restored."); else toast.error(r.error.message);
                }}><ArchiveRestore /> Restore</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>
              )
            ) : null}
            {canDelete ? (
              <>
                {canArchive ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ClientFormSheet open={editing} onOpenChange={setEditing} initial={form} options={options} />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archive ${name}?`}
        description="Archived clients are hidden from the main list but keep all their history. You can restore them any time."
        confirmLabel="Archive"
        onConfirm={async () => {
          const r = await setClientArchivedAction(id, true);
          if (!r.ok) { toast.error(r.error.message); return false; }
          toast.success("Client archived.");
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${name}?`}
        description="The client will be removed from the app. Prefer Archive if you might need it again."
        confirmLabel="Delete client"
        destructive
        onConfirm={async () => {
          const r = await deleteClientAction(id);
          if (r && !r.ok) { toast.error(r.error.message); return false; }
        }}
      />
    </>
  );
}

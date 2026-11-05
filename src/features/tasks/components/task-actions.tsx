"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { deleteTaskAction } from "../actions";
import type { TaskInput } from "../schemas";
import { TaskFormSheet, type TaskFormOptions } from "./task-form-sheet";

export function TaskActions({ id, title, form, options }: { id: string; title: string; form: TaskInput; options: TaskFormOptions }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2 /> Delete task</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskFormSheet open={editing} onOpenChange={setEditing} initial={form} options={options} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={`Delete “${title}”?`} destructive confirmLabel="Delete task"
        description="The task, its comments and history will be removed from the app."
        onConfirm={async () => { const r = await deleteTaskAction(id); if (r && !r.ok) { toast.error(r.error.message); return false; } }} />
    </>
  );
}

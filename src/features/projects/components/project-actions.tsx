"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useCan } from "@/components/providers/session-provider";
import { TaskFormSheet, type TaskFormOptions } from "@/features/tasks/components/task-form-sheet";
import { addProjectNoteAction, deleteProjectAction } from "../actions";
import type { ProjectInput } from "../schemas";
import { ProjectFormSheet, type ProjectFormOptions } from "./project-form-sheet";

export function ProjectActions({ id, name, form, options }: { id: string; name: string; form: ProjectInput; options: ProjectFormOptions }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2 /> Delete project</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectFormSheet open={editing} onOpenChange={setEditing} initial={form} options={options} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={`Delete “${name}”?`} destructive confirmLabel="Delete project"
        description="The project is removed from the app. Its tasks and linked expenses keep their records."
        onConfirm={async () => { const r = await deleteProjectAction(id); if (r && !r.ok) { toast.error(r.error.message); return false; } }} />
    </>
  );
}

export function AddProjectTask({ projectId, clientId, options }: { projectId: string; clientId: string; options: TaskFormOptions }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  if (!can("tasks.manage")) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus /> Add task</Button>
      <TaskFormSheet open={open} onOpenChange={setOpen} options={options} preset={{ projectId, clientId }} />
    </>
  );
}

export function ProjectNoteComposer({ projectId }: { projectId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form className="space-y-2 rounded-lg border bg-muted/30 p-3" onSubmit={(e) => {
      e.preventDefault();
      startTransition(async () => {
        const r = await addProjectNoteAction({ projectId, body });
        if (!r.ok) return void toast.error(r.error.fieldErrors?.body?.[0] ?? r.error.message);
        setBody("");
        toast.success("Note added.");
      });
    }}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an update, decision or note…" aria-label="Project note" className="min-h-16 bg-background" />
      <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !body.trim()}>{pending ? <Spinner /> : null} Add note</Button></div>
    </form>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { SelectField } from "@/components/forms/select-field";
import { ComboboxField } from "@/components/forms/combobox-field";
import { MultiSelectField } from "@/components/forms/multi-select-field";
import { DateField } from "@/components/forms/date-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import type { ComboOption } from "@/components/forms/combobox";
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/constants";
import { saveTaskAction } from "../actions";
import { taskSchema, type TaskInput } from "../schemas";

export type TaskFormOptions = { users: ComboOption[]; projects: (ComboOption & { clientId: string | null })[]; clients: ComboOption[] };

export function TaskFormSheet({ open, onOpenChange, initial, preset, options, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: TaskInput | null; preset?: Partial<TaskInput>; options: TaskFormOptions;
  onSaved?: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{initial?.id ? "Edit task" : "New task"}</SheetTitle>
          <SheetDescription>{initial?.id ? "Changes are recorded in the task's history." : "Assign work to the team."}</SheetDescription>
        </SheetHeader>
        {open ? <TaskForm key={initial?.id ?? "new"} initial={initial ?? null} preset={preset} options={options} onDone={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({ initial, preset, options, onDone, onSaved }: {
  initial: TaskInput | null; preset?: Partial<TaskInput>; options: TaskFormOptions; onDone: () => void; onSaved?: (id: string) => void;
}) {
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: initial ?? {
      title: "", description: "", projectId: "", clientId: "", assigneeIds: [], dueDate: "", priority: "medium", status: "todo", ...preset,
    },
  });
  const projectId = useWatch({ control: form.control, name: "projectId" });
  // Picking a project fills in its client.
  const last = useRef(projectId);
  useEffect(() => {
    if (projectId === last.current) return;
    last.current = projectId;
    const p = options.projects.find((x) => x.value === projectId);
    if (p?.clientId) form.setValue("clientId", p.clientId);
  }, [projectId, options.projects, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const r = await saveTaskAction(values);
    if (!r.ok) return applyActionError(form, r.error);
    toast.success(initial?.id ? "Task updated." : "Task created.");
    onDone();
    onSaved?.(r.data.id);
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <TextField control={form.control} name="title" label="Title" required placeholder="e.g. Design November content calendar" />
          <TextField control={form.control} name="description" label="Details" multiline inputClassName="min-h-24" />
          <MultiSelectField control={form.control} name="assigneeIds" label="Assignees" options={options.users} placeholder="Assign people" />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField control={form.control} name="dueDate" label="Due date" />
            <SelectField control={form.control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />
          </div>
          <SelectField control={form.control} name="status" label="Status" options={TASK_STATUS_OPTIONS} />
          <ComboboxField control={form.control} name="projectId" label="Project" options={options.projects} placeholder="No project" searchPlaceholder="Search projects…" />
          <ComboboxField control={form.control} name="clientId" label="Client" options={options.clients} placeholder="No client" searchPlaceholder="Search clients…" />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Spinner /> : null} {initial?.id ? "Save changes" : "Create task"}</Button>
      </SheetFooter>
    </form>
  );
}

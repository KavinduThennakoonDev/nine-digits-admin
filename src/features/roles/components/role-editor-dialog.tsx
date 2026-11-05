"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { saveRoleAction } from "../actions";
import { roleSchema } from "../schemas";
import type { RoleRow } from "../queries";

export function RoleEditorDialog({ open, role, onOpenChange }: { open: boolean; role: RoleRow | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>{role ? `Edit ${role.name}` : "New role"}</DialogTitle>
          <DialogDescription>Choose what people with this role can see and do. Changes apply on their next page load.</DialogDescription>
        </DialogHeader>
        {open ? <RoleForm key={role?.id ?? "new"} role={role} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({ role, onDone }: { role: RoleRow | null; onDone: () => void }) {
  const form = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: { id: role?.id, name: role?.name ?? "", description: role?.description ?? "", permissions: role?.permissions ?? ["dashboard.view"] },
  });
  const selected = new Set(useWatch({ control: form.control, name: "permissions" }) ?? []);
  const setPerms = (keys: Set<string>) => form.setValue("permissions", [...keys], { shouldDirty: true });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await saveRoleAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(role ? "Role updated." : "Role created.");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="name" label="Role name" required disabled={role?.isSystem} />
          <TextField control={form.control} name="description" label="Description" />
        </FieldGroup>
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((group) => {
            const keys = group.permissions.map((p) => p.key as string);
            const count = keys.filter((k) => selected.has(k)).length;
            const all = count === keys.length;
            return (
              <fieldset key={group.module} className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <legend className="text-sm font-medium">{group.label}</legend>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular">{count}/{keys.length}</span>
                    <Checkbox
                      aria-label={`Toggle all ${group.label} permissions`}
                      checked={all ? true : count > 0 ? "indeterminate" : false}
                      onCheckedChange={() => {
                        const next = new Set(selected);
                        keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
                        setPerms(next);
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-x-4 gap-y-1 p-2 sm:grid-cols-2">
                  {group.permissions.map((p) => (
                    <Label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-muted/50">
                      <Checkbox
                        checked={selected.has(p.key)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(p.key); else next.delete(p.key);
                          setPerms(next);
                        }}
                      />
                      {p.label}
                    </Label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>
      <DialogFooter className="border-t p-4">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} {role ? "Save changes" : "Create role"}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextField } from "@/components/forms/text-field";
import { applyActionError } from "@/components/forms/apply-action-error";
import { useSession } from "@/components/providers/session-provider";
import { PERMISSION_GROUPS, SUPER_ADMIN_SLUG } from "@/lib/permissions";
import { USER_STATUSES } from "@/lib/constants";
import { createUserAction, updateUserAction } from "../actions";
import { createUserSchema, updateUserSchema } from "../schemas";
import type { UserRow } from "../queries";

export type RoleOption = { id: string; name: string; slug: string; permissions: string[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleOption[];
  user?: UserRow | null;
};

export function UserFormSheet({ open, onOpenChange, roles, user }: Props) {
  const session = useSession();
  const assignable = roles.filter((r) => session.isSuperAdmin || r.slug !== SUPER_ADMIN_SLUG);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{user ? "Edit user" : "Add user"}</SheetTitle>
          <SheetDescription>
            {user ? `Update ${user.name}'s details, role and access.` : "Create an account. They'll be asked to set their own password on first sign-in."}
          </SheetDescription>
        </SheetHeader>
        {open ? (
          user ? (
            <EditUserForm key={user.id} user={user} roles={roles} isSelf={user.id === session.id} onDone={() => onOpenChange(false)} />
          ) : (
            <CreateUserForm roles={assignable} onDone={() => onOpenChange(false)} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RoleSelect({ value, onChange, roles, invalid, disabled }: { value: string; onChange: (v: string) => void; roles: RoleOption[]; invalid?: boolean; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id="roleId" className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateUserForm({ roles, onDone }: { roles: RoleOption[]; onDone: () => void }) {
  const form = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", roleId: roles.find((r) => r.slug === "employee")?.id ?? "", jobTitle: "", phone: "", password: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createUserAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success(`${values.name} was added. Share the temporary password with them securely.`);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <TextField control={form.control} name="name" label="Full name" required autoComplete="off" />
          <TextField control={form.control} name="email" label="Email" type="email" required autoComplete="off" />
          <Controller
            control={form.control}
            name="roleId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="roleId">Role<span className="text-destructive">*</span></FieldLabel>
                <RoleSelect value={field.value} onChange={field.onChange} roles={roles} invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="jobTitle" label="Job title" placeholder="e.g. Social Media Executive" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
          </div>
          <TextField control={form.control} name="password" label="Temporary password" type="text" required autoComplete="new-password"
            description="At least 10 characters with letters and numbers. They must change it on first sign-in." />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Create user
        </Button>
      </SheetFooter>
    </form>
  );
}

type Override = "inherit" | "grant" | "deny";

function EditUserForm({ user, roles, isSelf, onDone }: { user: UserRow; roles: RoleOption[]; isSelf: boolean; onDone: () => void }) {
  const session = useSession();
  const lockedSuper = user.roleSlug === SUPER_ADMIN_SLUG && !session.isSuperAdmin;
  // Non-super admins can't assign Super Admin, but still see it when viewing one.
  const roleOptions = lockedSuper ? roles : roles.filter((r) => session.isSuperAdmin || r.slug !== SUPER_ADMIN_SLUG);
  const form = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user.id, name: user.name, email: user.email, roleId: user.roleId, jobTitle: user.jobTitle,
      phone: user.phone, status: user.status, grant: user.grant, deny: user.deny,
    },
  });

  const roleId = useWatch({ control: form.control, name: "roleId" });
  const grant = useWatch({ control: form.control, name: "grant" }) ?? [];
  const deny = useWatch({ control: form.control, name: "deny" }) ?? [];
  const role = roles.find((r) => r.id === roleId);
  const roleIsSuper = role?.slug === SUPER_ADMIN_SLUG;
  const rolePerms = useMemo(() => new Set(role?.permissions ?? []), [role]);

  const setOverride = (key: string, value: Override) => {
    form.setValue("grant", value === "grant" ? [...grant.filter((k) => k !== key), key] : grant.filter((k) => k !== key), { shouldDirty: true });
    form.setValue("deny", value === "deny" ? [...deny.filter((k) => k !== key), key] : deny.filter((k) => k !== key), { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateUserAction(values);
    if (!result.ok) return applyActionError(form, result.error);
    toast.success("User updated.");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b px-4 py-2">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="access" disabled={roleIsSuper}>Access overrides</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details" className="flex-1 overflow-y-auto p-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Full name" required disabled={lockedSuper} />
            <TextField control={form.control} name="email" label="Email" type="email" required disabled={lockedSuper} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="roleId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="roleId">Role</FieldLabel>
                    <RoleSelect value={field.value} onChange={field.onChange} roles={roleOptions}
                      invalid={fieldState.invalid} disabled={isSelf || lockedSuper} />
                    {isSelf ? <FieldDescription>You can’t change your own role.</FieldDescription> : null}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSelf || lockedSuper}>
                      <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {USER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value !== "active" && !isSelf ? <FieldDescription>Inactive users are signed out and can’t sign in.</FieldDescription> : null}
                  </Field>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="jobTitle" label="Job title" disabled={lockedSuper} />
              <TextField control={form.control} name="phone" label="Phone" type="tel" disabled={lockedSuper} />
            </div>
          </FieldGroup>
        </TabsContent>
        <TabsContent value="access" className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Fine-tune access on top of the <span className="font-medium text-foreground">{role?.name}</span> role. “Inherit” follows the role.
          </p>
          <div className="space-y-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.module} className="space-y-1.5">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</h4>
                <div className="divide-y rounded-lg border">
                  {group.permissions.map((p) => {
                    const value: Override = grant.includes(p.key) ? "grant" : deny.includes(p.key) ? "deny" : "inherit";
                    const effective = value === "grant" || (value === "inherit" && rolePerms.has(p.key));
                    return (
                      <div key={p.key} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{effective ? "Allowed" : "Not allowed"}{value === "inherit" ? " by role" : " (override)"}</p>
                        </div>
                        <Select value={value} onValueChange={(v) => setOverride(p.key, v as Override)} disabled={lockedSuper}>
                          <SelectTrigger size="sm" className="w-28" aria-label={`Override for ${p.label}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">Inherit</SelectItem>
                            <SelectItem value="grant">Allow</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting || lockedSuper}>
          {form.formState.isSubmitting ? <Spinner /> : null} Save changes
        </Button>
      </SheetFooter>
    </form>
  );
}

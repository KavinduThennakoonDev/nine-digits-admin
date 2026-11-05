"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/forms/text-field";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { applyActionError } from "@/components/forms/apply-action-error";
import { FIELD_TYPE_META, TABLE_ICONS, TABLE_LEVEL_OPTIONS, type FieldDef, type TableIcon } from "@/lib/dynamic/types";
import { cn } from "@/lib/utils";
import type { TableMeta } from "@/server/services/dynamic-tables";
import {
  deleteTableAction, previewFieldChangeAction, purgeFieldAction, reorderFieldsAction, saveFieldAction, setFieldArchivedAction,
  setTableArchivedAction, updateAccessAction, updateTableMetaAction,
} from "../actions";
import { tableMetaSchema } from "../schemas";
import { FieldDialog, fieldToDraft } from "./field-dialog";
import { TableIconView } from "./table-icon";

type Role = { id: string; name: string; slug: string };

export function StructureEditor({ table, usage, recordCount, legacy, roles }: {
  table: TableMeta; usage: Record<string, number>; recordCount: number; legacy: number; roles: Role[];
}) {
  const active = table.fields.filter((f) => !f.archivedAt);
  const archived = table.fields.filter((f) => f.archivedAt);
  const [dialog, setDialog] = useState<{ open: boolean; field: FieldDef | null }>({ open: false, field: null });
  const [purge, setPurge] = useState<FieldDef | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(success); else toast.error(r.error?.message ?? "Something went wrong.");
    });

  const move = (i: number, d: -1 | 1) => {
    const ids = active.map((f) => f.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    act(() => reorderFieldsAction(table.id, [...ids, ...archived.map((f) => f.id)]), "Order saved.");
  };

  return (
    <>
      <Link href={`/tables/${table.slug}`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {table.name}
      </Link>
      <PageHeader title="Table structure" description={`${recordCount.toLocaleString()} record${recordCount === 1 ? "" : "s"} · schema version ${table.schemaVersion}`} />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-4">
          <MetaCard table={table} />
          <AccessCard table={table} roles={roles} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fields</CardTitle>
              <CardDescription>Values are stored by a permanent field ID, so renaming fields or options never touches records.</CardDescription>
              <CardAction><Button size="sm" onClick={() => setDialog({ open: true, field: null })}><Plus /> Add field</Button></CardAction>
            </CardHeader>
            <CardContent>
              {legacy ? (
                <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  {legacy} record{legacy === 1 ? " has" : "s have"} values set aside by an earlier type change. They&apos;re marked with a warning icon in the table.
                </p>
              ) : null}
              <ol className="divide-y rounded-lg border">
                {active.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {f.label}{f.required ? <span className="text-destructive">*</span> : null}
                        {!f.showInTable ? <EyeOff className="size-3.5 text-muted-foreground" aria-label="Hidden in table" /> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {FIELD_TYPE_META[f.type].label} · <span className="font-mono">{f.key}</span> · {usage[f.id] ?? 0} filled
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${f.label} up`} disabled={pending || i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${f.label} down`} disabled={pending || i === active.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${f.label}`} onClick={() => setDialog({ open: true, field: f })}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Archive ${f.label}`} disabled={pending || active.length <= 1}
                      onClick={() => act(() => setFieldArchivedAction(table.id, f.id, true), `“${f.label}” archived. Its data is kept.`)}><Archive /></Button>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {archived.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Archived fields</CardTitle>
                <CardDescription>Hidden from forms, tables and exports. Every record still keeps its value — restore any time.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y rounded-lg border">
                  {archived.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-muted-foreground">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{FIELD_TYPE_META[f.type].label} · {usage[f.id] ?? 0} values kept</p>
                      </div>
                      <Button variant="outline" size="sm" disabled={pending}
                        onClick={() => act(() => setFieldArchivedAction(table.id, f.id, false), `“${f.label}” restored.`)}><ArchiveRestore /> Restore</Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.label} permanently`} onClick={() => setPurge(f)}><Trash2 /></Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <DangerCard table={table} recordCount={recordCount} />
        </div>
      </div>

      <FieldDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.field ? fieldToDraft(dialog.field) : null}
        originalType={dialog.field?.type}
        recordCount={recordCount}
        onPreview={(draft) => previewFieldChangeAction(table.id, draft)}
        onSave={async (draft, ctx) => {
          const r = await saveFieldAction(table.id, draft, ctx);
          if (r.ok) toast.success(r.data.converted ? `Converted ${r.data.converted.convertible} value(s).` : dialog.field ? "Field saved." : "Field added.");
          return r;
        }}
      />
      <TypeToConfirm
        open={!!purge}
        onOpenChange={(o) => !o && setPurge(null)}
        title={`Delete “${purge?.label}” permanently?`}
        description={`This removes the field and its value from all ${recordCount} records. This can't be undone.`}
        expected={purge?.label ?? ""}
        confirmLabel="Delete field permanently"
        onConfirm={(typed) => purgeFieldAction(table.id, purge!.id, typed)}
        success="Field deleted permanently."
      />
    </>
  );
}

function MetaCard({ table }: { table: TableMeta }) {
  const form = useForm({ resolver: zodResolver(tableMetaSchema), defaultValues: { name: table.name, description: table.description, icon: table.icon } });
  const icon = useWatch({ control: form.control, name: "icon" });
  const onSubmit = form.handleSubmit(async (values) => {
    const r = await updateTableMetaAction(table.id, values);
    if (!r.ok) return applyActionError(form, r.error);
    form.reset(values);
    toast.success("Table details saved.");
  });
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" required />
            <TextField control={form.control} name="description" label="Description" multiline />
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Icon</legend>
              <div className="flex flex-wrap gap-1.5">
                {TABLE_ICONS.map((i) => (
                  <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => form.setValue("icon", i as TableIcon, { shouldDirty: true })}
                    className={cn("flex size-8 items-center justify-center rounded-lg border", icon === i ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                    <TableIconView icon={i} className="size-4" />
                  </button>
                ))}
              </div>
            </fieldset>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>{form.formState.isSubmitting ? <Spinner /> : null} Save</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AccessCard({ table, roles }: { table: TableMeta; roles: Role[] }) {
  const [defaultLevel, setDefaultLevel] = useState(table.defaultLevel);
  const [overrides, setOverrides] = useState<Record<string, string>>(Object.fromEntries(table.roleAccess.map((r) => [r.roleId, r.level])));
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => {
    const roleAccess = Object.entries(overrides).filter(([, l]) => l && l !== "default").map(([roleId, level]) => ({ roleId, level: level as "none" | "view" | "edit" }));
    const r = await updateAccessAction({ tableId: table.id, defaultLevel, roleAccess });
    if (r.ok) toast.success("Access saved."); else toast.error(r.error.message);
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access</CardTitle>
        <CardDescription>For people whose role has “Access custom tables”. Roles with “Create & configure tables” always have full access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Everyone else</p>
          <Select value={defaultLevel} onValueChange={(v) => setDefaultLevel(v as typeof defaultLevel)}>
            <SelectTrigger className="w-full" aria-label="Default access"><SelectValue /></SelectTrigger>
            <SelectContent>{TABLE_LEVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label} — {o.description}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <ul className="divide-y rounded-lg border">
          {roles.filter((r) => r.slug !== "super-admin").map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm">{r.name}</span>
              <Select value={overrides[r.id] ?? "default"} onValueChange={(v) => setOverrides((o) => ({ ...o, [r.id]: v }))}>
                <SelectTrigger size="sm" className="w-32" aria-label={`Access for ${r.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {TABLE_LEVEL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button onClick={save} disabled={pending}>{pending ? <Spinner /> : null} Save access</Button>
      </CardFooter>
    </Card>
  );
}

function DangerCard({ table, recordCount }: { table: TableMeta; recordCount: number }) {
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Archive or delete</CardTitle>
        <CardDescription>Archiving makes the table read-only and hides it from the sidebar. Deleting removes it from the app; its records stay in the database.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
          const r = await setTableArchivedAction(table.id, !table.archivedAt);
          if (r.ok) toast.success(table.archivedAt ? "Table restored." : "Table archived."); else toast.error(r.error.message);
        })}>
          {table.archivedAt ? <><ArchiveRestore /> Restore table</> : <><Archive /> Archive table</>}
        </Button>
        <Button variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> Delete table</Button>
        {table.archivedAt ? <StatusBadge tone="warning" dot={false}>Archived</StatusBadge> : null}
      </CardContent>
      <TypeToConfirm
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${table.name}”?`}
        description={`The table and its ${recordCount} record${recordCount === 1 ? "" : "s"} will disappear from the app.`}
        expected={table.name}
        confirmLabel="Delete table"
        onConfirm={(typed) => deleteTableAction(table.id, typed)}
        success="Table deleted."
      />
    </Card>
  );
}

function TypeToConfirm({
  open, onOpenChange, title, description, expected, confirmLabel, onConfirm, success,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; expected: string; confirmLabel: string;
  onConfirm: (typed: string) => Promise<{ ok: boolean; error?: { message: string } } | void>; success: string;
}) {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setTyped(""); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description} Type <span className="font-medium text-foreground">{expected}</span> to confirm.</DialogDescription>
        </DialogHeader>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={typed !== expected || pending} onClick={() => startTransition(async () => {
            const r = await onConfirm(typed);
            if (r && !r.ok) return void toast.error(r.error?.message ?? "Something went wrong.");
            toast.success(success);
            onOpenChange(false);
          })}>{pending ? <Spinner /> : null} {confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

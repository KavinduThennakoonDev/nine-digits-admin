"use client";

import { useState } from "react";
import { Lock, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { useCan, useSession } from "@/components/providers/session-provider";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { deleteRoleAction } from "../actions";
import type { RoleRow } from "../queries";
import { RoleEditorDialog } from "./role-editor-dialog";

export function RolesView({ roles }: { roles: RoleRow[] }) {
  const can = useCan();
  const session = useSession();
  const canManage = can("roles.manage");
  const [editor, setEditor] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });
  const [toDelete, setToDelete] = useState<RoleRow | null>(null);

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Roles bundle permissions. Individual users can also get allow/deny overrides from the Users page."
        actions={canManage ? <Button onClick={() => setEditor({ open: true, role: null })}><Plus /> New role</Button> : null}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const editable = canManage && !role.isSuperAdmin && (session.isSuperAdmin || role.name !== session.roleName);
          const pct = Math.round((role.permissions.length / ALL_PERMISSIONS.length) * 100);
          return (
            <Card key={role.id} className="gap-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {role.isSuperAdmin ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />}
                    </span>
                    <CardTitle className="truncate">{role.name}</CardTitle>
                  </div>
                  {editable ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role.name}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditor({ open: true, role })}><Pencil /> Edit permissions</DropdownMenuItem>
                        {!role.isSystem ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(role)}><Trash2 /> Delete role</DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <CardDescription className="line-clamp-2 min-h-10">{role.description || "No description."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{role.isSuperAdmin ? "All permissions" : `${role.permissions.length} of ${ALL_PERMISSIONS.length} permissions`}</span>
                  <span className="tabular">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
              <CardFooter className="justify-between text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {role.userCount} {role.userCount === 1 ? "user" : "users"}</span>
                {role.isSystem ? <StatusBadge dot={false}>System</StatusBadge> : <StatusBadge tone="info" dot={false}>Custom</StatusBadge>}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <RoleEditorDialog open={editor.open} role={editor.role} onOpenChange={(open) => setEditor((e) => ({ ...e, open }))} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "role"}?`}
        description="This can't be undone. Roles that still have users assigned can't be deleted."
        confirmLabel="Delete role"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          const result = await deleteRoleAction(toDelete.id);
          if (!result.ok) {
            toast.error(result.error.message);
            return false;
          }
          toast.success("Role deleted.");
        }}
      />
    </>
  );
}

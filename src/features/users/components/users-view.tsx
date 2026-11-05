"use client";

import { useMemo, useState } from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { createDataTableColumns } from "@/components/data-table/features";
import { DataTableReset, DataTableSearch, DataTableSelectFilter } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge, type Tone } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/layout/user-avatar";
import { useCan, useSession } from "@/components/providers/session-provider";
import { formatDate } from "@/lib/format";
import { RelativeTime } from "@/components/feedback/relative-time";
import { SUPER_ADMIN_SLUG } from "@/lib/permissions";
import type { Paginated } from "@/lib/list-params";
import type { UserRow } from "../queries";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { UserFormSheet, type RoleOption } from "./user-form-sheet";

const statusTone: Record<UserRow["status"], Tone> = { active: "success", inactive: "neutral", suspended: "danger" };

const col = createDataTableColumns<UserRow>();

export function UsersView({ data, roles }: { data: Paginated<UserRow>; roles: RoleOption[] }) {
  const can = useCan();
  const session = useSession();
  const canManage = can("users.manage");
  const [sheet, setSheet] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [resetFor, setResetFor] = useState<UserRow | null>(null);

  const columns = useMemo(() => [
    col.accessor("name", {
      header: "User",
      meta: { sortKey: "name" },
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={row.original.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.name}
              {row.original.id === session.id ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    }),
    col.accessor("roleName", {
      header: "Role",
      meta: { label: "Role" },
      cell: ({ row }) => (
        <StatusBadge tone={row.original.roleSlug === SUPER_ADMIN_SLUG ? "brand" : "neutral"} dot={false}>{row.original.roleName}</StatusBadge>
      ),
    }),
    col.accessor("jobTitle", {
      header: "Job title",
      meta: { label: "Job title", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => getValue() || "—",
    }),
    col.accessor("status", {
      header: "Status",
      meta: { sortKey: "status", label: "Status" },
      cell: ({ getValue }) => <StatusBadge tone={statusTone[getValue()]}><span className="capitalize">{getValue()}</span></StatusBadge>,
    }),
    col.accessor("lastLoginAt", {
      header: "Last sign-in",
      meta: { sortKey: "lastLoginAt", label: "Last sign-in", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => (getValue() ? <RelativeTime value={getValue()} mode="ago" /> : "Never"),
    }),
    col.accessor("createdAt", {
      header: "Added",
      meta: { sortKey: "createdAt", label: "Added", cellClassName: "text-muted-foreground" },
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    ...(canManage
      ? [
          col.display({
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableHiding: false,
            meta: { cellClassName: "w-10 text-right" },
            cell: ({ row }) => {
              const u = row.original;
              const locked = u.roleSlug === SUPER_ADMIN_SLUG && !session.isSuperAdmin;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setSheet({ open: true, user: u })}>
                      <Pencil /> {locked ? "View" : "Edit"}
                    </DropdownMenuItem>
                    {u.id !== session.id && !locked ? (
                      <DropdownMenuItem onSelect={() => setResetFor(u)}>
                        <KeyRound /> Reset password
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          }),
        ]
      : []),
  ], [canManage, session.id, session.isSuperAdmin]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can sign in to the workspace, their role and their access."
        actions={
          canManage ? (
            <Button onClick={() => setSheet({ open: true, user: null })}>
              <Plus /> Add user
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        pageCount={data.pageCount}
        getRowId={(r) => r.id}
        defaultSort="createdAt"
        onRowClick={canManage ? (u) => setSheet({ open: true, user: u }) : undefined}
        toolbar={
          <>
            <DataTableSearch placeholder="Search name, email, title…" />
            <DataTableSelectFilter param="role" label="Roles" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
            <DataTableSelectFilter param="status" label="Statuses" options={[
              { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" },
            ]} />
            <DataTableReset params={["q", "status", "role"]} />
          </>
        }
        empty={
          <EmptyState icon={Users} title="No users match" description="Try a different search or filter." className="border-0" />
        }
      />
      <UserFormSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} roles={roles} user={sheet.user} />
      <ResetPasswordDialog user={resetFor} onOpenChange={(open) => !open && setResetFor(null)} />
    </>
  );
}

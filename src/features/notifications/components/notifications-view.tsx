"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrlStateProvider } from "@/components/data-table/url-state";
import { DataTableSegments } from "@/components/data-table/view-toggle";
import { DataTableSelectFilter } from "@/components/data-table/toolbar";
import { DataTablePagination } from "@/components/data-table/pagination";
import { EmptyState } from "@/components/feedback/empty-state";
import { RelativeTime } from "@/components/feedback/relative-time";
import { PageHeader } from "@/components/layout/page-header";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/lib/list-params";
import { markReadAction } from "../actions";
import type { NotificationItem } from "../queries";
import { NotificationIcon } from "./notification-icon";

export function NotificationsView({ data, unread }: { data: Paginated<NotificationItem>; unread: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <UrlStateProvider>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread ? <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { await markReadAction(); })}><CheckCheck /> Mark all read</Button> : null} />
      <div className="flex flex-wrap items-center gap-2">
        <DataTableSegments param="show" options={[{ value: "", label: "All" }, { value: "unread", label: "Unread" }]} />
        <DataTableSelectFilter param="type" label="Types" options={NOTIFICATION_TYPES.map((t) => ({ value: t, label: NOTIFICATION_TYPE_META[t].label }))} />
      </div>
      {data.rows.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" description="Reminders and updates will appear here." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {data.rows.map((n) => (
            <li key={n.id}>
              <button type="button" className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50", !n.read && "bg-primary/5")}
                onClick={() => startTransition(async () => { if (!n.read) await markReadAction([n.id]); if (n.link) router.push(n.link); })}>
                <NotificationIcon type={n.type} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !n.read && "font-medium")}>{n.title}</span>
                  {n.body ? <span className="block text-sm text-muted-foreground">{n.body}</span> : null}
                  <span className="block text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>
                    {NOTIFICATION_TYPE_META[n.type].label} · <RelativeTime value={n.createdAt} mode="ago" />
                  </span>
                </span>
                {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <DataTablePagination total={data.total} page={data.page} pageSize={data.pageSize} pageCount={data.pageCount} />
    </UrlStateProvider>
  );
}

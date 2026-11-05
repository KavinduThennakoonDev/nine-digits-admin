import { History } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { UserAvatar } from "@/components/layout/user-avatar";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { ActivityItem } from "../queries";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Actions like sign-ins and record changes will appear here." className="border-0" />;
  }
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <UserAvatar name={item.userName} className="size-7" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{item.userName}</span>{" "}
              <span className="text-muted-foreground">{item.summary || `${item.action} · ${item.module}`}</span>
            </p>
            <p className="text-xs text-muted-foreground" title={formatDateTime(item.createdAt)}>
              {timeAgo(item.createdAt)} · <span className="capitalize">{item.module}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

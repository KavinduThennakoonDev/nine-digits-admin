import Link from "next/link";
import { AlarmClock, CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FollowUpItem } from "../queries";

export function FollowUpList({ items }: { items: FollowUpItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={CalendarCheck} title="You're all caught up" description="No follow-ups overdue or due in the next 7 days." className="border-0" />;
  }
  return (
    <ul className="-mx-2 divide-y">
      {items.map((f) => (
        <li key={f.id}>
          <Link href={`/leads/${f.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", f.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
              <AlarmClock className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{[f.company, f.assignedName].filter(Boolean).join(" · ") || "—"}</span>
            </span>
            <span className={cn("shrink-0 text-right text-xs", f.overdue ? "font-medium text-destructive" : "text-muted-foreground")} title={formatDateTime(f.at)}>
              {f.overdue ? "Overdue · " : ""}{relative(f.at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

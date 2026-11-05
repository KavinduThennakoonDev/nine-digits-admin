"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RelativeTime } from "@/components/feedback/relative-time";
import { cn } from "@/lib/utils";
import { markReadAction } from "../actions";
import type { NotificationItem } from "../queries";
import { NotificationIcon } from "./notification-icon";

const POLL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] }>({ unread: 0, items: [] });
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // offline or signed out — keep the last state
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const openItem = (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) startTransition(async () => { await markReadAction([n.id]); load(); });
    if (n.link) router.push(n.link);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}>
          <Bell />
          {data.unread ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular">
              {data.unread > 99 ? "99+" : data.unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {data.unread ? (
            <Button variant="ghost" size="xs" onClick={() => startTransition(async () => { await markReadAction(); load(); })}>
              <CheckCheck /> Mark all read
            </Button>
          ) : null}
        </div>
        {data.items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className={cn("flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60", !n.read && "bg-primary/5")}>
                  <NotificationIcon type={n.type} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-medium")}>{n.title}</span>
                    {n.body ? <span className="block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                    <span className="block text-[11px] text-muted-foreground"><RelativeTime value={n.createdAt} mode="ago" /></span>
                  </span>
                  {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" asChild><Link href="/notifications" onClick={() => setOpen(false)}>View all notifications</Link></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

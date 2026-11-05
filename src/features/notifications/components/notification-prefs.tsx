"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_META, type NotificationType } from "@/lib/constants";
import { updateNotificationPrefsAction } from "../actions";

export function NotificationPrefs({ muted: initial }: { muted: NotificationType[] }) {
  const [muted, setMuted] = useState(new Set(initial));
  const [pending, startTransition] = useTransition();
  const toggle = (t: NotificationType, on: boolean) => {
    const next = new Set(muted);
    if (on) next.delete(t); else next.add(t);
    setMuted(next);
    startTransition(async () => {
      const r = await updateNotificationPrefsAction({ muted: [...next] });
      if (!r.ok) toast.error(r.error.message); else toast.success("Notification settings saved.");
    });
  };
  return (
    <ul className="divide-y rounded-lg border">
      {NOTIFICATION_TYPES.map((t) => (
        <li key={t} className="flex items-center justify-between gap-4 px-3 py-2.5">
          <label htmlFor={`notif-${t}`} className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">{NOTIFICATION_TYPE_META[t].label}</span>
            <span className="block text-xs text-muted-foreground">{NOTIFICATION_TYPE_META[t].description}</span>
          </label>
          <Switch id={`notif-${t}`} checked={!muted.has(t)} disabled={pending} onCheckedChange={(v) => toggle(t, v)} />
        </li>
      ))}
    </ul>
  );
}

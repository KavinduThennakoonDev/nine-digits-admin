"use client";

import { formatDateTime, relative, timeAgo } from "@/lib/format";

/**
 * Relative timestamps ("in 3 hours", "5 minutes ago") drift between the server
 * render and hydration, so the text is allowed to differ on the client.
 */
export function RelativeTime({ value, mode = "relative", className }: { value: string | null; mode?: "relative" | "ago"; className?: string }) {
  if (!value) return null;
  return (
    <time dateTime={value} title={formatDateTime(value)} className={className} suppressHydrationWarning>
      {mode === "ago" ? timeAgo(value) : relative(value)}
    </time>
  );
}

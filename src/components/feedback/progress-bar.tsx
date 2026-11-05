import { cn } from "@/lib/utils";

/** Small labelled progress bar; turns red when over 100% (e.g. budget overrun). */
export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-label={label}
      aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", pct > 100 ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

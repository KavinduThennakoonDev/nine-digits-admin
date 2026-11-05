import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-chart-2/12 text-chart-2",
  brand: "bg-primary/12 text-primary",
};

export function StatusBadge({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

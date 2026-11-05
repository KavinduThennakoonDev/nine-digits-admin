import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {Icon ? (
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

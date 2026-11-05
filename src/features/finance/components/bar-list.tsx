import Link from "next/link";
import type { Currency } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

/** Ranked horizontal bars — values are printed, so colour is never the only cue. */
export function BarList({
  rows, base, color, hrefFor, empty, format = "money",
}: {
  rows: { id: string; name: string; total: number; hint?: string }[];
  base: Currency;
  color: string;
  hrefFor?: (id: string) => string;
  empty: React.ReactNode;
  /** How values print; shares are only shown for additive values (money/number). */
  format?: "money" | "number" | "percent";
}) {
  if (rows.length === 0) return <>{empty}</>;
  const max = Math.max(...rows.map((r) => r.total), 1);
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const label = hrefFor ? <Link href={hrefFor(r.id)} className="truncate hover:underline">{r.name}</Link> : <span className="truncate">{r.name}</span>;
        return (
          <li key={r.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {label}
              <span className="tabular shrink-0 font-medium">
                {format === "money" ? formatMoney(r.total, base) : format === "percent" ? `${Math.round(r.total * 100)}%` : r.total.toLocaleString("en-US")}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {format === "percent" ? r.hint ?? "" : `${sum ? Math.round((r.total / sum) * 100) : 0}%`}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.total / max) * 100)}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

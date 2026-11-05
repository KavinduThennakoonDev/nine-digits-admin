"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { Currency } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

// Validated categorical slots (colour-blind safe in both themes, see globals.css).
const SLOTS = ["var(--chart-1)", "var(--chart-2)"];
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export type TrendPoint = Record<string, string | number | null>;

/** Monthly bars for 1–2 series. Money values are minor units in `base`. */
export function TrendChart({ points, series, format, base, height = 260 }: {
  points: TrendPoint[]; series: { key: string; label: string }[]; format: "money" | "number"; base: Currency; height?: number;
}) {
  const config = Object.fromEntries(series.slice(0, 2).map((s, i) => [s.key, { label: s.label, color: SLOTS[i] }])) satisfies ChartConfig;
  const fmt = (v: number) => (format === "money" ? formatMoney(v, base) : v.toLocaleString("en-US"));
  return (
    <div className="space-y-3">
      {series.length > 1 ? (
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
          {series.slice(0, 2).map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: SLOTS[i] }} />{s.label}</li>
          ))}
        </ul>
      ) : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={points} barGap={2} barCategoryGap="22%" accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false}
            tickFormatter={(v: number) => compact.format(format === "money" ? v / 100 : v)} />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => {
            if (!p.active || !p.payload?.length) return null;
            const point = p.payload[0]?.payload as TrendPoint;
            return (
              <div className="grid min-w-40 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                <p className="font-medium">{String(p.label ?? "")}</p>
                {series.slice(0, 2).map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-[2px]" style={{ background: SLOTS[i] }} />
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="tabular ml-auto font-medium">{fmt(Number(point[s.key] ?? 0))}</span>
                  </div>
                ))}
              </div>
            );
          }} />
          {series.slice(0, 2).map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

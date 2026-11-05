"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { Currency } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { MonthPoint } from "../queries";

// Colours validated for colour-blind separation and contrast in both themes (see globals.css --chart-1/2).
const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

type TipProps = { active?: boolean; payload?: readonly { payload?: unknown }[]; label?: unknown; base: Currency };

function MoneyTooltip({ active, payload, label, base }: TipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as MonthPoint;
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="font-medium">{String(label ?? "")}</p>
      {(["revenue", "expenses"] as const).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="size-2.5 rounded-[2px]" style={{ background: config[k].color }} />
          <span className="text-muted-foreground">{config[k].label}</span>
          <span className="tabular ml-auto font-medium">{formatMoney(point[k], base)}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t pt-1.5">
        <span className="text-muted-foreground">Profit</span>
        <span className="tabular ml-auto font-medium">{formatMoney(point.profit, base)}</span>
      </div>
    </div>
  );
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function RevenueExpenseChart({ points, base }: { points: MonthPoint[]; base: Currency }) {
  return (
    <div className="space-y-3">
    {/* Fixed-order legend (Recharts sorts its own legend alphabetically). */}
    <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
      {(["revenue", "expenses"] as const).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: config[k].color }} />{config[k].label}
        </li>
      ))}
    </ul>
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={points} barGap={2} barCategoryGap="22%" accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compact.format(v / 100)} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => <MoneyTooltip active={p.active} payload={p.payload} label={p.label} base={base} />} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
        <Bar dataKey="expenses" name="Expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
      </BarChart>
    </ChartContainer>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/feedback/stat-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarList } from "@/features/finance/components/bar-list";
import { cn } from "@/lib/utils";
import type { ColumnType, ReportResult } from "../definitions";
import { formatCell } from "../format";

const numeric = (t: ColumnType) => t === "money" || t === "number" || t === "percent";

export function ReportView({ report }: { report: ReportResult }) {
  const { base } = report;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {report.stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={formatCell(s.format, s.value, base)} hint={s.hint} />
        ))}
      </div>
      {report.charts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.charts.map((c, i) => (
            <Card key={c.title} className={cn(c.kind === "trend" && i === 0 && report.charts.length % 2 === 1 && "lg:col-span-2")}>
              <CardHeader><CardTitle>{c.title}</CardTitle></CardHeader>
              <CardContent>
                {c.kind === "trend" ? (
                  <TrendChart points={c.points} series={c.series} format={c.format} base={base} />
                ) : (
                  <BarList base={base} color="var(--chart-1)" format={c.format}
                    rows={c.rows.map((r) => ({ id: r.id, name: r.name, total: r.value, hint: r.hint }))}
                    empty={<p className="text-sm text-muted-foreground">No data for this period.</p>} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {report.tables.map((t) => (
        <Card key={t.title}>
          <CardHeader><CardTitle>{t.title}</CardTitle></CardHeader>
          <CardContent>
            {t.rows.length === 0 ? <p className="text-sm text-muted-foreground">No records in this period.</p> : (
              <div className="max-h-[32rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow className="hover:bg-transparent">
                      {t.columns.map((c) => <TableHead key={c.key} className={cn("text-xs text-muted-foreground", numeric(c.type) && "text-right")}>{c.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.rows.map((r, i) => (
                      <TableRow key={i}>
                        {t.columns.map((c, ci) => (
                          <TableCell key={c.key} className={cn(numeric(c.type) && "tabular text-right", ci === 0 && "font-medium", c.type === "money" && typeof r[c.key] === "number" && (r[c.key] as number) < 0 && "text-destructive")}>
                            {formatCell(c.type, r[c.key], base)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  {t.totals ? (
                    <TableFooter>
                      <TableRow>
                        {t.columns.map((c) => <TableCell key={c.key} className={cn("font-semibold", numeric(c.type) && "tabular text-right")}>{t.totals![c.key] === undefined ? "" : formatCell(c.type, t.totals![c.key], base)}</TableCell>)}
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t.rows.length.toLocaleString()} row{t.rows.length === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, ArrowDownRight, ArrowUpRight, CircleDollarSign, FileText, Plus, Receipt, Scale, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/feedback/stat-card";
import { can, requireUser } from "@/server/auth/dal";
import {
  getExpensesByCategory, getFinanceOverview, getMonthlySeries, getOverdueInvoices, getRecentPayments, getRevenueByClient, getYearPnl,
} from "@/features/finance/queries";
import { RevenueExpenseChart } from "@/features/finance/components/revenue-expense-chart";
import { BarList } from "@/features/finance/components/bar-list";
import { PnlTable } from "@/features/finance/components/pnl-table";
import { PeriodSegments, YearSelect } from "@/features/finance/components/period-controls";
import { first } from "@/lib/list-params";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { agencyYearMonth, isPeriod, PERIOD_OPTIONS, type Period } from "@/lib/periods";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "finance.view")) return <AccessDenied />;
  const sp = await searchParams;
  const p = first(sp.period);
  const period: Period = isPeriod(p) ? p : "this_month";
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)!.label.toLowerCase();
  const currentYear = agencyYearMonth().year;
  const yearParam = Number(first(sp.year));
  const year = Number.isInteger(yearParam) && yearParam > 2000 && yearParam <= currentYear ? yearParam : currentYear;

  const [overview, series, byCategory, byClient, overdue, recent, pnl] = await Promise.all([
    getFinanceOverview(period), getMonthlySeries(), getExpensesByCategory(period), getRevenueByClient(period),
    getOverdueInvoices(), getRecentPayments(), getYearPnl(year),
  ]);
  const base = overview.base;
  const money = (v: number) => formatMoney(v, base);

  return (
    <PageContainer>
      <PageHeader
        title="Finance"
        description={`Revenue is money actually received (completed payments). Figures are in ${base}, converted at each record's own exchange rate.`}
        actions={
          <>
            {can(user, "expenses.manage") ? <Button variant="outline" asChild><Link href="/finance/expenses"><Receipt /> Expenses</Link></Button> : null}
            {can(user, "invoices.manage") ? <Button asChild><Link href="/finance/invoices/new"><Plus /> New invoice</Link></Button> : null}
          </>
        }
      />
      <PeriodSegments />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(overview.revenue)} icon={ArrowDownRight}
          hint={`${overview.paymentCount} payment${overview.paymentCount === 1 ? "" : "s"} · ${periodLabel}`} />
        <StatCard label="Expenses" value={money(overview.expenses)} icon={ArrowUpRight}
          hint={`${overview.expenseCount} expense${overview.expenseCount === 1 ? "" : "s"} · ${periodLabel}`} />
        <StatCard label="Net profit" value={<span className={overview.profit < 0 ? "text-destructive" : undefined}>{money(overview.profit)}</span>} icon={Scale}
          hint={overview.margin === null ? "No revenue in this period" : `${Math.round(overview.margin * 100)}% margin`} />
        <StatCard label="Outstanding" value={money(overview.receivables.outstanding)} icon={AlarmClock}
          className={overview.receivables.overdueCount ? "border-destructive/30" : undefined}
          hint={overview.receivables.overdueCount
            ? <Link href="/finance/invoices?status=overdue" className="text-destructive hover:underline">{money(overview.receivables.overdue)} overdue ({overview.receivables.overdueCount}) →</Link>
            : `${overview.receivables.openCount} unpaid invoice${overview.receivables.openCount === 1 ? "" : "s"}, none overdue`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs expenses</CardTitle>
          <CardDescription>Last 12 months · invoiced {periodLabel}: {money(overview.invoiced)} across {overview.invoiceCount} invoice{overview.invoiceCount === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent>
          {series.points.some((pt) => pt.revenue || pt.expenses) ? (
            <RevenueExpenseChart points={series.points} base={series.base} />
          ) : (
            <EmptyState icon={CircleDollarSign} title="No financial activity yet" className="border-0"
              description="Record payments and expenses to see monthly trends." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by client</CardTitle><CardDescription>Top clients · {periodLabel}</CardDescription></CardHeader>
          <CardContent>
            <BarList rows={byClient.rows} base={base} color="var(--chart-1)" hrefFor={(id) => `/clients/${id}`}
              empty={<p className="text-sm text-muted-foreground">No payments received {periodLabel}.</p>} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expenses by category</CardTitle><CardDescription>{periodLabel.replace(/^./, (c) => c.toUpperCase())}</CardDescription></CardHeader>
          <CardContent>
            <BarList rows={byCategory.rows} base={base} color="var(--chart-2)"
              empty={<p className="text-sm text-muted-foreground">No expenses recorded {periodLabel}.</p>} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue invoices</CardTitle>
            <CardDescription>Oldest first</CardDescription>
            <CardAction><Button variant="ghost" size="sm" asChild><Link href="/finance/invoices?status=overdue">View all</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? <EmptyState icon={FileText} title="Nothing overdue" description="All issued invoices are within terms." className="border-0" /> : (
              <ul className="-mx-2 divide-y">
                {overdue.map((i) => (
                  <li key={i.id}>
                    <Link href={`/finance/invoices/${i.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{i.clientName}</span>
                        <span className="block text-xs text-muted-foreground"><span className="font-mono">{i.number}</span> · due {formatDay(i.dueDate)}</span>
                      </span>
                      <span className="tabular text-sm font-medium text-destructive">{formatMoney(i.balance, i.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardDescription>Latest money received</CardDescription>
            <CardAction><Button variant="ghost" size="sm" asChild><Link href="/finance/payments">View all</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? <EmptyState icon={Wallet} title="No payments yet" description="Recorded payments appear here." className="border-0" /> : (
              <ul className="-mx-2 divide-y">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.clientName}</span>
                      <span className="block text-xs text-muted-foreground">{formatDay(p.paymentDate)}{p.invoiceNumber ? ` · ${p.invoiceNumber}` : " · standalone"}</span>
                    </span>
                    <span className="tabular text-sm font-medium">{formatMoney(p.amount, p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {can(user, "reports.finance") ? (
        <Card>
          <CardHeader>
            <CardTitle>Profit & loss</CardTitle>
            <CardDescription>Monthly, quarterly and yearly totals in {pnl.base}</CardDescription>
            <CardAction><YearSelect years={pnl.years} value={year} /></CardAction>
          </CardHeader>
          <CardContent><PnlTable rows={pnl.rows} base={pnl.base} /></CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

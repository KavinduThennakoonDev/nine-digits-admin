import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { isReportKey, REPORTS, runReport } from "@/features/reports/definitions";
import { ReportView } from "@/features/reports/components/report-view";
import { ReportControls } from "@/features/reports/components/report-controls";
import { first } from "@/lib/list-params";
import { resolveRange } from "@/lib/periods";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const available = REPORTS.filter((r) => can(user, r.permission));
  if (!can(user, "reports.view") && !can(user, "reports.finance")) return <AccessDenied />;
  if (!available.length) return <AccessDenied />;
  const sp = await searchParams;
  const requested = first(sp.report);
  const def = available.find((r) => r.key === requested) ?? available[0];
  if (requested && isReportKey(requested) && !available.some((r) => r.key === requested)) {
    return <AccessDenied message="This report needs the financial reports permission." />;
  }
  const range = resolveRange(sp, "this_year");
  const report = await runReport(def.key, range);
  const keep = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "report" || v === undefined ? [] : [[k, String(Array.isArray(v) ? v[0] : v)]])));

  return (
    <PageContainer className="max-w-none">
      <PageHeader title="Reports" description="Filter by date range and export any report to CSV or Excel." />
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Reports" className="lg:sticky lg:top-18 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {available.map((r) => {
              const p = new URLSearchParams(keep); p.set("report", r.key);
              return (
                <li key={r.key}>
                  <Link href={`/reports?${p.toString()}`} aria-current={r.key === def.key ? "page" : undefined}
                    className={cn("block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-muted", r.key === def.key && "bg-muted font-medium")}>
                    {r.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{def.label}</h2>
              <p className="text-sm text-muted-foreground">{def.description} · {range.label}</p>
            </div>
            <ReportControls reportKey={def.key} />
          </div>
          <ReportView report={report} />
        </div>
      </div>
    </PageContainer>
  );
}

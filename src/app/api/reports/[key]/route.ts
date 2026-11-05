import { NextResponse, type NextRequest } from "next/server";
import { can, getCurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { toCsv, toXlsxSheets } from "@/server/services/export";
import { isReportKey, REPORTS, runReport, type ColumnType } from "@/features/reports/definitions";
import { formatCell } from "@/features/reports/format";
import { resolveRange } from "@/lib/periods";

/** Excel keeps numbers numeric (money in major units, percent as a fraction); CSV uses display text. */
const excelValue = (type: ColumnType, v: string | number | null | undefined) => {
  if (v === null || v === undefined) return null;
  if (type === "money" && typeof v === "number") return v / 100;
  if ((type === "number" || type === "percent") && typeof v === "number") return v;
  if (type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { key } = await params;
  if (!isReportKey(key)) return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  const def = REPORTS.find((r) => r.key === key)!;
  if (!can(user, def.permission)) return NextResponse.json({ error: "No access to this report." }, { status: 403 });

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = resolveRange(sp, "this_year");
  const report = await runReport(key, range);
  const format = sp.format === "xlsx" ? "xlsx" : "csv";
  const filename = `nine-digits-${key}-report-${range.key}`;
  await audit({ userId: user.id, action: "export", module: "reports", summary: `Exported ${def.label} report (${range.label}, ${format.toUpperCase()})` });

  const withTotals = (t: (typeof report.tables)[number]) => (t.totals ? [...t.rows, t.totals] : t.rows);
  if (format === "xlsx") {
    const buffer = await toXlsxSheets(report.tables.map((t) => ({
      name: t.title,
      columns: t.columns.map((c) => ({ header: c.label || "Name", width: c.type === "text" ? 24 : 16 })),
      rows: withTotals(t).map((r) => t.columns.map((c) => excelValue(c.type, r[c.key]))),
    })));
    return new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "no-store",
    } });
  }
  // CSV: every table, separated by a blank line and its title.
  const csv = report.tables.map((t) =>
    `${t.title}\r\n` + toCsv(
      t.columns.map((c) => ({ header: c.label || "Name", value: (r: Record<string, string | number | null>) => (r[c.key] === undefined ? "" : formatCell(c.type, r[c.key], report.base)) })),
      withTotals(t),
    ).replace(/^﻿/, ""),
  ).join("\r\n\r\n");
  return new NextResponse("﻿" + csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"`, "Cache-Control": "no-store",
  } });
}

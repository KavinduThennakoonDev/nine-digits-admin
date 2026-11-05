import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/server/db/connect";
import { DynamicRecord } from "@/server/db/models/dynamic-record";
import { DynamicTable } from "@/server/db/models/dynamic-table";
import { can, getCurrentUser } from "@/server/auth/dal";
import { activeFields, serializeTable } from "@/server/services/dynamic-tables";
import { audit } from "@/server/services/audit";
import { toCsv, toXlsx, type ExportColumn } from "@/server/services/export";
import { buildRecordFilter, recordSort } from "@/features/tables/queries";
import { formatValue } from "@/lib/dynamic/registry";
import type { StoredValue } from "@/lib/dynamic/types";
import { formatDateTime } from "@/lib/format";

const MAX_ROWS = 50_000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!can(user, "tables.view")) return NextResponse.json({ error: "No access to tables." }, { status: 403 });
  const { slug } = await params;
  await connectDB();
  const raw = await DynamicTable.findOne({ slug, deletedAt: null }).lean();
  const table = raw ? serializeTable(raw, user) : null;
  if (!table || table.level === "none") return NextResponse.json({ error: "Table not found." }, { status: 404 });

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { key, dir } = recordSort(table, sp);
  const records = await DynamicRecord.find(buildRecordFilter(table, sp)).sort({ [key]: dir, _id: dir }).limit(MAX_ROWS).lean();
  type R = (typeof records)[number];
  const columns: ExportColumn<R>[] = [
    ...activeFields(table.fields).map((f): ExportColumn<R> => ({
      header: f.label,
      width: f.type === "textarea" ? 40 : 20,
      // Numbers/currency stay numeric in Excel; everything else uses the same formatting as the app.
      value: (r) => {
        const v = ((r.data ?? {}) as Record<string, StoredValue>)[f.id];
        if (f.type === "number" && typeof v === "number") return v;
        if (f.type === "currency" && typeof v === "number") return v / 100;
        return formatValue(f, v);
      },
    })),
    { header: "Created", width: 20, value: (r) => formatDateTime(r.createdAt as Date) },
  ];
  await audit({ userId: user.id, action: "export", module: `table:${table.slug}`, summary: `Exported ${records.length} record(s) from “${table.name}”` });

  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filename = `${table.slug}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "xlsx") {
    const buffer = await toXlsx(table.name.slice(0, 31), columns, records);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(toCsv(columns, records), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"`, "Cache-Control": "no-store" },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/server/db/connect";
import { ActivityLog } from "@/server/db/models/activity-log";
import { User } from "@/server/db/models/user";
import { can, getCurrentUser } from "@/server/auth/dal";
import { toCsv, type ExportColumn } from "@/server/services/export";
import { buildActivityFilter } from "@/features/activity/queries";
import { formatDateTime } from "@/lib/format";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!can(user, "activity.view")) return NextResponse.json({ error: "No access." }, { status: 403 });
  await connectDB();
  const logs = await ActivityLog.find(buildActivityFilter(Object.fromEntries(request.nextUrl.searchParams.entries()))).sort({ createdAt: -1 }).limit(50_000).lean();
  const users = await User.find({ _id: { $in: logs.map((l) => l.userId).filter(Boolean) } }, { name: 1 }).lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  type L = (typeof logs)[number];
  const columns: ExportColumn<L>[] = [
    { header: "When", value: (l) => formatDateTime(l.createdAt as Date) },
    { header: "User", value: (l) => (l.userId ? names.get(String(l.userId)) ?? "Deleted user" : "System") },
    { header: "Action", value: (l) => l.action },
    { header: "Module", value: (l) => l.module },
    { header: "Record ID", value: (l) => (l.recordId ? String(l.recordId) : "") },
    { header: "Details", value: (l) => l.summary ?? "" },
    { header: "Previous value", value: (l) => (l.before ? JSON.stringify(l.before) : "") },
    { header: "New value", value: (l) => (l.after ? JSON.stringify(l.after) : "") },
    { header: "IP", value: (l) => l.ip ?? "" },
  ];
  return new NextResponse(toCsv(columns, logs), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

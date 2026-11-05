import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/server/db/connect";
import { Lead } from "@/server/db/models/lead";
import { Service } from "@/server/db/models/service";
import { User } from "@/server/db/models/user";
import { can, getCurrentUser } from "@/server/auth/dal";
import { audit } from "@/server/services/audit";
import { toCsv, toXlsx, type ExportColumn } from "@/server/services/export";
import { buildLeadFilter } from "@/features/leads/filters";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { formatDateTime, formatDay } from "@/lib/format";

const MAX_ROWS = 50_000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!can(user, "leads.view", "leads.export")) return NextResponse.json({ error: "You don't have permission to export leads." }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  await connectDB();
  const leads = await Lead.find(buildLeadFilter(sp, user)).sort({ leadDate: -1, _id: 1 }).limit(MAX_ROWS).lean();

  const [users, services] = await Promise.all([
    User.find({ _id: { $in: [...new Set(leads.map((l) => String(l.assignedTo)).filter((v) => v !== "null"))] } }, { name: 1 }).lean(),
    Service.find({ _id: { $in: [...new Set(leads.map((l) => String(l.interestedServiceId)).filter((v) => v !== "null"))] } }, { name: 1 }).lean(),
  ]);
  const userName = new Map(users.map((u) => [String(u._id), u.name]));
  const serviceName = new Map(services.map((s) => [String(s._id), s.name]));

  type L = (typeof leads)[number];
  const columns: ExportColumn<L>[] = [
    { header: "Full name", width: 24, value: (l) => l.fullName },
    { header: "Company", width: 22, value: (l) => l.company ?? "" },
    { header: "Email", width: 26, value: (l) => l.email ?? "" },
    { header: "Phone", width: 16, value: (l) => l.phone ?? "" },
    { header: "WhatsApp", width: 16, value: (l) => l.whatsapp ?? "" },
    { header: "Country", width: 16, value: (l) => l.country ?? "" },
    { header: "Source", width: 12, value: (l) => labelOf(LEAD_SOURCE_OPTIONS, l.source) },
    { header: "Status", width: 18, value: (l) => labelOf(LEAD_STATUS_OPTIONS, l.status) },
    { header: "Interested service", width: 24, value: (l) => (l.interestedServiceId ? serviceName.get(String(l.interestedServiceId)) ?? "" : "") },
    { header: "Assigned to", width: 20, value: (l) => (l.assignedTo ? userName.get(String(l.assignedTo)) ?? "" : "") },
    { header: "Lead date", width: 14, value: (l) => formatDay(l.leadDate) },
    { header: "Next follow-up", width: 22, value: (l) => (l.nextFollowUpAt ? formatDateTime(l.nextFollowUpAt) : "") },
    { header: "Last contacted", width: 22, value: (l) => (l.lastContactedAt ? formatDateTime(l.lastContactedAt) : "") },
    { header: "Notes", width: 40, value: (l) => l.notes ?? "" },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  await audit({ userId: user.id, action: "export", module: "leads", summary: `Exported ${leads.length} leads (${format.toUpperCase()})` });

  if (format === "xlsx") {
    const buffer = await toXlsx("Leads", columns, leads);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="nine-digits-leads-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(toCsv(columns, leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nine-digits-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

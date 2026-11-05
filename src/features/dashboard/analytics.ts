import "server-only";
import { connectDB } from "@/server/db/connect";
import { Client } from "@/server/db/models/client";
import { Lead } from "@/server/db/models/lead";
import { Project } from "@/server/db/models/project";
import { assignedScope } from "@/server/auth/scope";
import { projectScope } from "@/server/services/work";
import type { CurrentUser } from "@/server/auth/dal";
import { LEAD_SOURCE_OPTIONS, PROJECT_STATUS_OPTIONS, labelOf } from "@/lib/constants";
import { APP_TIMEZONE } from "@/lib/format";
import { agencyYearMonth, periodRange, rangeMatch } from "@/lib/periods";

type Range = { from: Date | null; to: Date | null };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Leads vs conversions per source in the range (respects lead visibility). */
export async function leadConversionBySource(user: CurrentUser, range: Range) {
  await connectDB();
  const m = rangeMatch(range);
  const rows = await Lead.aggregate<{ _id: string; leads: number; converted: number }>([
    { $match: { deletedAt: null, ...(m ? { leadDate: m } : {}), ...assignedScope(user, "leads.view_all") } },
    { $group: { _id: "$source", leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } } } },
    { $sort: { leads: -1 } },
  ]);
  return rows.map((r) => ({ label: labelOf(LEAD_SOURCE_OPTIONS, r._id), leads: r.leads, converted: r.converted }));
}

/** New clients per month over the last 12 months (respects client visibility). */
export async function clientGrowth(user: CurrentUser) {
  await connectDB();
  const range = periodRange("last_12_months");
  const rows = await Client.aggregate<{ _id: string; n: number }>([
    { $match: { deletedAt: null, createdAt: rangeMatch(range), ...assignedScope(user, "clients.view_all") } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: APP_TIMEZONE } }, n: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r.n]));
  const { year, month } = agencyYearMonth();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 11 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, clients: map.get(key) ?? 0 };
  });
}

export async function projectStatusDistribution(user: CurrentUser) {
  await connectDB();
  const rows = await Project.aggregate<{ _id: string; n: number }>([
    { $match: { deletedAt: null, ...projectScope(user) } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  return rows.map((r) => ({ id: r._id, name: labelOf(PROJECT_STATUS_OPTIONS, r._id), total: r.n }));
}

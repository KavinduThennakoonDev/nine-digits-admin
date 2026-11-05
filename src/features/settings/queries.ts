import "server-only";
import { connectDB } from "@/server/db/connect";
import { Settings } from "@/server/db/models/settings";
import { Lead } from "@/server/db/models/lead";
import type { Currency } from "@/lib/constants";

export type AppSettings = {
  agency: { name: string; legalName: string; email: string; phone: string; website: string; address: string; country: string; taxId: string };
  currency: { base: Currency; usdToLkr: number; rateHistory: { usdToLkr: number; changedAt: string }[] };
  invoice: { prefix: string; defaultDueDays: number };
};

/** Reads (and lazily creates) the singleton settings document. Callers authorize first. */
export async function getSettings(): Promise<AppSettings> {
  await connectDB();
  const s = await Settings.findOneAndUpdate({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true, returnDocument: "after" }).lean();
  return {
    agency: {
      name: s.agency?.name ?? "Nine Digits",
      legalName: s.agency?.legalName ?? "",
      email: s.agency?.email ?? "",
      phone: s.agency?.phone ?? "",
      website: s.agency?.website ?? "",
      address: s.agency?.address ?? "",
      country: s.agency?.country ?? "",
      taxId: s.agency?.taxId ?? "",
    },
    currency: {
      base: (s.currency?.base ?? "LKR") as Currency,
      usdToLkr: s.currency?.usdToLkr ?? 300,
      rateHistory: (s.currency?.rateHistory ?? [])
        .slice(-10)
        .reverse()
        .map((r) => ({ usdToLkr: r.usdToLkr ?? 0, changedAt: r.changedAt ? new Date(r.changedAt).toISOString() : "" })),
    },
    invoice: { prefix: s.invoice?.prefix ?? "ND", defaultDueDays: s.invoice?.defaultDueDays ?? 14 },
  };
}

/** How many leads (including archived) sit in each status — needed before a status can be removed. */
export async function getLeadStatusUsage(): Promise<Record<string, number>> {
  await connectDB();
  const rows = await Lead.aggregate<{ _id: string; n: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

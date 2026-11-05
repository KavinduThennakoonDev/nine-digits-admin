import "server-only";
import { connectDB } from "@/server/db/connect";
import { Settings } from "@/server/db/models/settings";
import type { Currency } from "@/lib/constants";

export type AppSettings = {
  agency: { name: string; legalName: string; email: string; phone: string; website: string; address: string; country: string; taxId: string };
  currency: { base: Currency; usdToLkr: number; rateHistory: { usdToLkr: number; changedAt: string }[] };
  invoice: { prefix: string; defaultDueDays: number };
};

/** Reads (and lazily creates) the singleton settings document. Callers authorize first. */
export async function getSettings(): Promise<AppSettings> {
  await connectDB();
  const s = await Settings.findOneAndUpdate({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true, new: true }).lean();
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

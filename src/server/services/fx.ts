import "server-only";
import { connectDB } from "../db/connect";
import { Settings } from "../db/models/settings";
import type { Currency } from "@/lib/constants";

export type FxContext = { base: Currency; usdToLkr: number };

export async function getFx(): Promise<FxContext> {
  await connectDB();
  const s = await Settings.findOne({ key: "global" }, { currency: 1 }).lean();
  return { base: (s?.currency?.base ?? "LKR") as Currency, usdToLkr: s?.currency?.usdToLkr ?? 300 };
}

/** Converts minor units between LKR and USD using a record's own rate snapshot. */
export function toBase(amount: number, currency: Currency, usdToLkr: number, base: Currency): number {
  if (currency === base) return amount;
  return Math.round(base === "LKR" ? amount * usdToLkr : amount / usdToLkr);
}

/**
 * Aggregation expression for the same conversion. `amountExpr` defaults to "$amount".
 * Each document converts with the rate stored on it, so historic figures never move.
 */
export function toBaseExpr(base: Currency, amountExpr: unknown = "$amount") {
  return {
    $round: [
      {
        $cond: [
          { $eq: ["$currency", base] },
          amountExpr,
          base === "LKR" ? { $multiply: [amountExpr, "$usdToLkr"] } : { $divide: [amountExpr, "$usdToLkr"] },
        ],
      },
      0,
    ],
  };
}

import type { Currency } from "./constants";

/**
 * Money is stored as integer minor units (cents) + currency to avoid float errors.
 * Both LKR and USD have 2 decimal places.
 */
export type Money = { amount: number; currency: Currency };

export const toMinor = (major: number) => Math.round(major * 100);
export const toMajor = (minor: number) => minor / 100;

const formatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(minor: number | null | undefined, currency: Currency, opts?: { compact?: boolean }) {
  if (minor === null || minor === undefined) return "—";
  const key = `${currency}-${opts?.compact ? "c" : "f"}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      notation: opts?.compact ? "compact" : "standard",
      maximumFractionDigits: opts?.compact ? 1 : 2,
      minimumFractionDigits: opts?.compact ? 0 : 2,
    });
    formatters.set(key, f);
  }
  return f.format(toMajor(minor)).replace(/ /g, " ");
}

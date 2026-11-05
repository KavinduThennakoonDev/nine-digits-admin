/**
 * Reporting periods in the agency timezone (Asia/Colombo, fixed +05:30, no DST).
 * Ranges are [from, to) as UTC instants.
 */
export const PERIODS = [
  "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "last_12_months", "all",
] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const OFFSET = "+05:30";
const at = (y: number, m: number) => {
  // Normalise month overflow (m may be <0 or >11).
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return new Date(`${yy}-${String(mm + 1).padStart(2, "0")}-01T00:00:00${OFFSET}`);
};

/** Year and month (0-based) of `now` in the agency timezone. */
export function agencyYearMonth(now = new Date()) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit" })
    .format(now).split("-").map(Number);
  return { year: y, month: m - 1 };
}

export function isPeriod(v: string | undefined | null): v is Period {
  return !!v && (PERIODS as readonly string[]).includes(v);
}

export function periodRange(period: Period, now = new Date()): { from: Date | null; to: Date | null } {
  const { year, month } = agencyYearMonth(now);
  const q = Math.floor(month / 3) * 3;
  switch (period) {
    case "this_month": return { from: at(year, month), to: at(year, month + 1) };
    case "last_month": return { from: at(year, month - 1), to: at(year, month) };
    case "this_quarter": return { from: at(year, q), to: at(year, q + 3) };
    case "last_quarter": return { from: at(year, q - 3), to: at(year, q) };
    case "this_year": return { from: at(year, 0), to: at(year + 1, 0) };
    case "last_year": return { from: at(year - 1, 0), to: at(year, 0) };
    case "last_12_months": return { from: at(year, month - 11), to: at(year, month + 1) };
    case "all": return { from: null, to: null };
  }
}

/** Mongo range condition for a date field, or undefined for "all time". */
export function periodMatch(period: Period) {
  const { from, to } = periodRange(period);
  return from && to ? { $gte: from, $lt: to } : undefined;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date range from URL params: ?period=<preset> or ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive days,
 * agency time). Falls back to `fallback`. `to` is exclusive in the returned range.
 */
export function resolveRange(
  sp: Record<string, string | string[] | undefined>,
  fallback: Period = "this_month",
): { from: Date | null; to: Date | null; label: string; key: string; custom: boolean } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const f = one(sp.from);
  const t = one(sp.to);
  if (f && t && DAY.test(f) && DAY.test(t) && f <= t) {
    const from = new Date(`${f}T00:00:00${OFFSET}`);
    const to = new Date(new Date(`${t}T00:00:00${OFFSET}`).getTime() + 86_400_000);
    return { from, to, label: `${f} to ${t}`, key: `${f}_${t}`, custom: true };
  }
  const p = one(sp.period);
  const period = isPeriod(p) ? p : fallback;
  const { from, to } = periodRange(period);
  return { from, to, label: PERIOD_OPTIONS.find((o) => o.value === period)!.label.toLowerCase(), key: period, custom: false };
}

/** Mongo condition for a resolved range (undefined = all time). */
export const rangeMatch = (r: { from: Date | null; to: Date | null }) => (r.from && r.to ? { $gte: r.from, $lt: r.to } : undefined);

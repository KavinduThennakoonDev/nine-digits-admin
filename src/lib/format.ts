import { formatDistanceToNowStrict } from "date-fns";

/** The agency's timezone. Servers (Vercel) run in UTC, so instants are always formatted here. */
export const APP_TIMEZONE = "Asia/Colombo";

type DateInput = string | Date | null | undefined;
const toDate = (v: DateInput) => (v ? (typeof v === "string" ? new Date(v) : v) : null);

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const instantDayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIMEZONE });

/** Date-only values (contract dates, lead date) are stored as UTC midnight. */
export const formatDay = (v: DateInput) => {
  const d = toDate(v);
  return d ? dayFmt.format(d) : "—";
};

/** The calendar day of an instant, in the agency timezone. */
export const formatDate = (v: DateInput) => {
  const d = toDate(v);
  return d ? instantDayFmt.format(d) : "—";
};

export const formatDateTime = (v: DateInput) => {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d).replace(" am", " AM").replace(" pm", " PM") : "—";
};

export const formatTime = (v: DateInput) => {
  const d = toDate(v);
  return d ? timeFmt.format(d).replace(" am", " AM").replace(" pm", " PM") : "—";
};

export const timeAgo = (v: DateInput) => {
  const d = toDate(v);
  return d ? `${formatDistanceToNowStrict(d)} ago` : "Never";
};

/** "in 3 hours" / "2 days ago" */
export const relative = (v: DateInput) => {
  const d = toDate(v);
  if (!d) return "—";
  const s = formatDistanceToNowStrict(d);
  return d.getTime() >= Date.now() ? `in ${s}` : `${s} ago`;
};

/** YYYY-MM-DD for a date-only value stored as UTC midnight. */
export const toDayString = (v: DateInput) => {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : "";
};

/** Start of "today" in the agency timezone, as a UTC instant. */
export function startOfAgencyDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // Colombo has a fixed +05:30 offset (no DST).
  return new Date(`${parts}T00:00:00+05:30`);
}

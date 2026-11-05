import { z } from "zod";
import { CURRENCIES } from "./constants";

/**
 * Wire-safe field schemas shared by client forms and Server Actions.
 * They never transform types (dates/money stay strings) so the same schema can
 * validate in the browser and again on the server; services convert afterwards.
 */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");
export const optionalId = z.union([z.literal(""), objectId]).default("");

export const text = (max = 200) => z.string().trim().max(max, `Use at most ${max} characters.`).default("");
export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`);

export const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email.")]).default("");
export const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d\s()-]*$/, "Use digits, spaces, +, - or brackets.")
  .default("");

/** YYYY-MM-DD or "" */
export const optionalDay = z.union([z.literal(""), z.iso.date("Enter a valid date.")]).default("");
export const requiredDay = z.iso.date("Pick a date.");
/** ISO instant or "" */
export const optionalInstant = z.union([z.literal(""), z.iso.datetime({ offset: true, message: "Enter a valid date and time." })]).default("");

/** Major units as typed by a person, e.g. "1500" or "1500.50", or "" */
export const optionalAmount = z
  .union([z.literal(""), z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50.")])
  .default("");
export const currency = z.enum(CURRENCIES);

/* ── Server-side converters ─────────────────────────────── */
export const dayToDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
export const instantToDate = (v: string) => (v ? new Date(v) : null);
export const amountToMinor = (v: string) => (v ? Math.round(Number(v) * 100) : null);
export const minorToAmount = (v: number | null | undefined) => (v === null || v === undefined ? "" : (v / 100).toFixed(2).replace(/\.00$/, ""));
export const idOrNull = (v: string) => (v ? v : null);

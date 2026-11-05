import { z } from "zod";
import { formatDateTime, formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { FieldDef, FieldInput, FieldType, StoredValue } from "./types";

/**
 * The single source of behaviour for every field type: validation, form <->
 * storage conversion, display, and CSV parsing. Client-safe (no server deps),
 * so forms, tables, imports and exports all agree.
 */

type Rule = Pick<FieldDef, "label" | "required" | "min" | "max" | "options" | "type" | "currency">;

const isEmpty = (v: unknown) => v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
const optionLabel = (f: Pick<FieldDef, "options">, id: string) => f.options.find((o) => o.id === id)?.label ?? `${id} (removed)`;
const toDate = (v: StoredValue): Date | null => (v instanceof Date ? v : typeof v === "string" && v ? new Date(v) : null);
const isValidDate = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());

/** Empty value in form/input format. */
export function emptyInput(type: FieldType): FieldInput {
  if (type === "multiselect") return [];
  if (type === "checkbox" || type === "boolean") return false;
  return "";
}

/** Zod schema for one field's *input* value. */
export function inputSchema(f: Rule): z.ZodType<FieldInput> {
  const req = (s: z.ZodString) => (f.required ? s.min(1, `${f.label} is required.`) : s);
  const lenMin = f.min ?? null;
  const lenMax = f.max ?? null;
  const withLength = (s: z.ZodString) => {
    let out = s;
    if (lenMax !== null) out = out.max(lenMax, `Use at most ${lenMax} characters.`);
    if (lenMin !== null) out = out.refine((v) => v === "" || v.length >= lenMin, `Use at least ${lenMin} characters.`) as unknown as z.ZodString;
    return out;
  };
  const numeric = (decimals: number) =>
    req(z.string().trim())
      .refine((v) => v === "" || new RegExp(`^-?\\d{1,13}(\\.\\d{1,${decimals}})?$`).test(v), decimals === 2 ? "Enter an amount like 1500 or 1500.50." : "Enter a number.")
      .refine((v) => v === "" || f.min === null || Number(v) >= f.min, `Must be at least ${f.min}.`)
      .refine((v) => v === "" || f.max === null || Number(v) <= f.max, `Must be at most ${f.max}.`);

  switch (f.type) {
    case "text":
    case "textarea":
      return withLength(req(z.string().trim().max(f.type === "text" ? 500 : 10000)));
    case "number":
      return numeric(6);
    case "currency":
      return numeric(2);
    case "email":
      return req(z.string().trim()).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email.");
    case "phone":
      return req(z.string().trim().max(30)).refine((v) => /^[+\d\s()-]*$/.test(v), "Use digits, spaces, +, - or brackets.");
    case "url":
    case "file":
      return req(z.string().trim().max(2000)).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a link starting with http:// or https://");
    case "date":
      return req(z.string()).refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a valid date.");
    case "datetime":
      return req(z.string()).refine((v) => v === "" || isValidDate(new Date(v)), "Pick a valid date and time.");
    case "select":
      return req(z.string()).refine((v) => v === "" || f.options.some((o) => o.id === v), "Pick one of the options.");
    case "multiselect": {
      let s = z.array(z.string()).refine((arr) => arr.every((v) => f.options.some((o) => o.id === v)), "Pick from the options.");
      if (f.required) s = s.refine((a) => a.length > 0, `${f.label} is required.`);
      if (f.min !== null) s = s.refine((a) => a.length === 0 || a.length >= f.min!, `Pick at least ${f.min}.`);
      if (f.max !== null) s = s.refine((a) => a.length <= f.max!, `Pick at most ${f.max}.`);
      return s;
    }
    case "checkbox":
      return f.required ? z.boolean().refine((v) => v, `${f.label} must be ticked.`) : z.boolean();
    case "boolean":
      return z.boolean();
  }
}

/** Builds the object schema for a whole record form, keyed by field id. */
export function recordSchema(fields: FieldDef[]) {
  return z.object(Object.fromEntries(fields.map((f) => [f.id, inputSchema(f)])));
}

/** Input (validated) → database value. */
export function toStored(f: Pick<FieldDef, "type">, input: FieldInput): StoredValue {
  if (isEmpty(input) && f.type !== "checkbox" && f.type !== "boolean") return null;
  switch (f.type) {
    case "number": return Number(input);
    case "currency": return Math.round(Number(input) * 100);
    case "date": return new Date(`${input}T00:00:00.000Z`);
    case "datetime": return new Date(input as string);
    case "multiselect": return [...new Set(input as string[])];
    case "checkbox":
    case "boolean": return Boolean(input);
    case "email": return String(input).trim().toLowerCase();
    default: return String(input).trim();
  }
}

/** Database value → form input (for editing). */
export function toInput(f: Pick<FieldDef, "type">, stored: StoredValue | undefined): FieldInput {
  if (stored === null || stored === undefined) return emptyInput(f.type);
  switch (f.type) {
    case "number": return String(stored);
    case "currency": return typeof stored === "number" ? (stored / 100).toFixed(2).replace(/\.00$/, "") : "";
    case "date": { const d = toDate(stored); return isValidDate(d) ? d.toISOString().slice(0, 10) : ""; }
    case "datetime": { const d = toDate(stored); return isValidDate(d) ? d.toISOString() : ""; }
    case "multiselect": return Array.isArray(stored) ? stored : [];
    case "checkbox":
    case "boolean": return Boolean(stored);
    default: return String(stored);
  }
}

/** Human-readable text (table cells, CSV/Excel export, search index). */
export function formatValue(f: Pick<FieldDef, "type" | "options" | "currency">, stored: StoredValue | undefined): string {
  if (stored === null || stored === undefined || (Array.isArray(stored) && stored.length === 0)) {
    return f.type === "checkbox" ? "No" : "";
  }
  switch (f.type) {
    case "currency": return typeof stored === "number" ? formatMoney(stored, f.currency) : "";
    case "number": return typeof stored === "number" ? stored.toLocaleString("en-US", { maximumFractionDigits: 6 }) : String(stored);
    case "date": return formatDay(toDate(stored));
    case "datetime": return formatDateTime(toDate(stored));
    case "select": return optionLabel(f, String(stored));
    case "multiselect": return (stored as string[]).map((id) => optionLabel(f, id)).join(", ");
    case "checkbox":
    case "boolean": return stored ? "Yes" : "No";
    default: return String(stored);
  }
}

const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * Parses free text (a CSV cell, or another field's formatted value during a type
 * change) into input format. Returns { ok: false } when it can't be understood.
 */
export function parseText(f: Pick<FieldDef, "type" | "options">, raw: string): { ok: true; value: FieldInput } | { ok: false; reason: string } {
  const v = (raw ?? "").trim();
  if (!v) return { ok: true, value: emptyInput(f.type) };
  const matchOption = (s: string) =>
    f.options.find((o) => o.label.toLowerCase() === s.toLowerCase() || o.id === s)?.id;
  switch (f.type) {
    case "number":
    case "currency": {
      const n = v.replace(/[,\s]/g, "").replace(/^(LKR|USD|Rs\.?|\$)/i, "");
      return /^-?\d+(\.\d+)?$/.test(n) ? { ok: true, value: f.type === "currency" ? Number(n).toFixed(2).replace(/\.00$/, "") : n } : { ok: false, reason: `“${v}” isn't a number` };
    }
    case "date": {
      // A real calendar day: Date silently rolls 31 Feb over to 3 Mar, so compare the round trip.
      const realDay = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return isValidDate(d) && d.toISOString().slice(0, 10) === iso; };
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return realDay(v.slice(0, 10)) ? { ok: true, value: v.slice(0, 10) } : { ok: false, reason: `“${v}” isn't a date` };
      const m = DMY.exec(v); // Sri Lankan / UK order: day/month/year
      if (m) {
        const [, d, mo, y] = m;
        const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
        return realDay(iso) ? { ok: true, value: iso } : { ok: false, reason: `“${v}” isn't a date` };
      }
      const t = Date.parse(`${v} UTC`);
      return Number.isNaN(t) ? { ok: false, reason: `“${v}” isn't a date` } : { ok: true, value: new Date(t).toISOString().slice(0, 10) };
    }
    case "datetime": {
      const t = Date.parse(v);
      return Number.isNaN(t) ? { ok: false, reason: `“${v}” isn't a date/time` } : { ok: true, value: new Date(t).toISOString() };
    }
    case "select": {
      const id = matchOption(v);
      return id ? { ok: true, value: id } : { ok: false, reason: `“${v}” isn't one of the options` };
    }
    case "multiselect": {
      const parts = v.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
      const ids = parts.map(matchOption);
      const bad = parts.filter((_, i) => !ids[i]);
      return bad.length ? { ok: false, reason: `“${bad.join(", ")}” isn't an option` } : { ok: true, value: ids as string[] };
    }
    case "checkbox":
    case "boolean": {
      if (/^(yes|y|true|1|✓|x|ticked|checked)$/i.test(v)) return { ok: true, value: true };
      if (/^(no|n|false|0|unticked|unchecked)$/i.test(v)) return { ok: true, value: false };
      return { ok: false, reason: `“${v}” isn't yes or no` };
    }
    default:
      return { ok: true, value: v };
  }
}

/** Default value in input format, falling back to empty. */
export function defaultInput(f: Pick<FieldDef, "type" | "defaultValue">): FieldInput {
  const d = f.defaultValue;
  if (f.type === "multiselect") return Array.isArray(d) ? d : [];
  if (f.type === "checkbox" || f.type === "boolean") return typeof d === "boolean" ? d : false;
  return typeof d === "string" ? d : "";
}

/** Short key from a label: "Travel Date" → "travel_date". */
export const keyFromLabel = (label: string) =>
  label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";

export const hasOptions = (t: FieldType) => t === "select" || t === "multiselect";
export const supportsMinMax = (t: FieldType) => ["text", "textarea", "number", "currency", "multiselect"].includes(t);
export const supportsPlaceholder = (t: FieldType) => ["text", "textarea", "number", "currency", "email", "phone", "url", "file"].includes(t);
/** Field types whose values can be filtered with a simple "equals" dropdown. */
export const isFilterable = (t: FieldType) => ["select", "multiselect", "checkbox", "boolean"].includes(t);
/** Field types that sort meaningfully in the database. */
export const isSortable = (t: FieldType) => !["multiselect", "textarea"].includes(t);

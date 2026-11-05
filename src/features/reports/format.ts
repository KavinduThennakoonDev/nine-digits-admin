import type { Currency } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { ColumnType } from "./definitions";

/** Display text for a report cell (shared by the page and CSV export). */
export function formatCell(type: ColumnType, v: string | number | null | undefined, base: Currency): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "money": return typeof v === "number" ? formatMoney(v, base) : String(v);
    case "percent": return typeof v === "number" ? `${Math.round(v * 100)}%` : String(v);
    case "number": return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
    case "date": return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDay(v) : String(v);
    default: return String(v);
  }
}

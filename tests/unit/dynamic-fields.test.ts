import { describe, expect, it } from "vitest";
import { formatValue, inputSchema, keyFromLabel, parseText, toInput, toStored } from "@/lib/dynamic/registry";
import type { FieldDef } from "@/lib/dynamic/types";

const field = (type: FieldDef["type"], extra: Partial<FieldDef> = {}): FieldDef => ({
  id: "f1", key: "f", label: "Field", type, required: false, placeholder: "", helpText: "", defaultValue: null,
  options: [{ id: "o1", label: "Colombo" }, { id: "o2", label: "Kandy" }], min: null, max: null, currency: "LKR",
  unique: false, archivedAt: null, order: 0, ...extra,
} as FieldDef);

describe("dynamic field registry", () => {
  it("round-trips values through storage", () => {
    expect(toStored(field("currency"), "1500.5")).toBe(150050);
    expect(toInput(field("currency"), 150050)).toBe("1500.50");
    expect(toStored(field("date"), "2026-05-01")).toEqual(new Date("2026-05-01T00:00:00Z"));
    expect(toInput(field("date"), new Date("2026-05-01T00:00:00Z"))).toBe("2026-05-01");
    expect(toStored(field("multiselect"), ["o1", "o1", "o2"])).toEqual(["o1", "o2"]);
    expect(toStored(field("email"), " A@B.LK ")).toBe("a@b.lk");
    expect(toStored(field("text"), "")).toBeNull();
    expect(toStored(field("checkbox"), false)).toBe(false);
  });

  it("parses imported text, including day-first dates and option labels", () => {
    expect(parseText(field("date"), "05/04/2026")).toEqual({ ok: true, value: "2026-04-05" });
    expect(parseText(field("date"), "31/02/2026").ok).toBe(false);
    expect(parseText(field("date"), "2026-02-30").ok).toBe(false);
    expect(parseText(field("date"), "29/02/2028")).toEqual({ ok: true, value: "2028-02-29" });
    expect(parseText(field("currency"), "LKR 12,500")).toEqual({ ok: true, value: "12500" });
    expect(parseText(field("select"), "kandy")).toEqual({ ok: true, value: "o2" });
    expect(parseText(field("multiselect"), "Colombo; Galle").ok).toBe(false);
    expect(parseText(field("boolean"), "Yes")).toEqual({ ok: true, value: true });
    expect(parseText(field("number"), "abc").ok).toBe(false);
  });

  it("validates required and min/max rules", () => {
    expect(inputSchema(field("text", { required: true })).safeParse("").success).toBe(false);
    expect(inputSchema(field("number", { min: 1, max: 10 })).safeParse("11").success).toBe(false);
    expect(inputSchema(field("number", { min: 1, max: 10 })).safeParse("5").success).toBe(true);
    expect(inputSchema(field("select")).safeParse("not-an-option").success).toBe(false);
    expect(inputSchema(field("email")).safeParse("nope").success).toBe(false);
  });

  it("formats for display and export", () => {
    expect(formatValue(field("multiselect"), ["o1", "o2"])).toBe("Colombo, Kandy");
    expect(formatValue(field("checkbox"), null)).toBe("No");
    expect(keyFromLabel("Travel Date")).toBe("travel_date");
  });
});

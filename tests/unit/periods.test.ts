import { describe, expect, it } from "vitest";
import { periodRange, resolveRange, agencyYearMonth } from "@/lib/periods";
import { startOfAgencyDay } from "@/lib/format";

// 2026-03-31 20:00 UTC is already 1 April 01:30 in Colombo (+05:30).
const lateMarchUtc = new Date("2026-03-31T20:00:00Z");

describe("agency-time periods", () => {
  it("uses Colombo's calendar, not UTC's", () => {
    expect(agencyYearMonth(lateMarchUtc)).toEqual({ year: 2026, month: 3 });
    expect(startOfAgencyDay(lateMarchUtc).toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });

  it("builds half-open month, quarter and year ranges", () => {
    expect(periodRange("this_month", lateMarchUtc)).toEqual({
      from: new Date("2026-04-01T00:00:00+05:30"), to: new Date("2026-05-01T00:00:00+05:30"),
    });
    expect(periodRange("last_quarter", lateMarchUtc)).toEqual({
      from: new Date("2026-01-01T00:00:00+05:30"), to: new Date("2026-04-01T00:00:00+05:30"),
    });
    expect(periodRange("last_month", new Date("2026-01-15T00:00:00Z"))).toEqual({
      from: new Date("2025-12-01T00:00:00+05:30"), to: new Date("2026-01-01T00:00:00+05:30"),
    });
    expect(periodRange("last_12_months", new Date("2026-06-15T00:00:00Z")).from).toEqual(new Date("2025-07-01T00:00:00+05:30"));
    expect(periodRange("all")).toEqual({ from: null, to: null });
  });

  it("parses custom ranges as inclusive days and rejects bad input", () => {
    const r = resolveRange({ from: "2026-01-01", to: "2026-01-31" });
    expect(r.custom).toBe(true);
    expect(r.from).toEqual(new Date("2026-01-01T00:00:00+05:30"));
    expect(r.to).toEqual(new Date("2026-02-01T00:00:00+05:30"));
    expect(resolveRange({ from: "2026-02-01", to: "2026-01-01" }, "this_year").key).toBe("this_year"); // reversed
    expect(resolveRange({ from: "nope", to: "2026-01-01" }, "all").key).toBe("all");
    expect(resolveRange({ period: "drop table" }, "last_month").key).toBe("last_month");
  });
});

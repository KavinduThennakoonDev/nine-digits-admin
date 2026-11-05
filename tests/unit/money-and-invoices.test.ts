import { describe, expect, it } from "vitest";
import { computeTotals, lineAmount, statusAfterPayments } from "@/lib/invoice-math";
import { formatMoney, toMajor, toMinor } from "@/lib/money";
import { amountToMinor, minorToAmount } from "@/lib/fields";

describe("money", () => {
  it("converts between major and minor units without float drift", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(1234.565)).toBe(123457);
    expect(toMajor(123457)).toBe(1234.57);
    expect(amountToMinor("19.99")).toBe(1999);
    expect(amountToMinor("")).toBeNull();
    expect(minorToAmount(150000)).toBe("1500");
    expect(minorToAmount(150050)).toBe("1500.50");
    expect(minorToAmount(null)).toBe("");
  });

  it("formats both currencies", () => {
    expect(formatMoney(2500000, "LKR")).toBe("LKR 25,000.00");
    expect(formatMoney(1999, "USD")).toBe("USD 19.99");
    expect(formatMoney(null, "LKR")).toBe("—");
  });
});

describe("invoice maths", () => {
  it("rounds each line to the cent", () => {
    expect(lineAmount({ quantity: 3, unitPrice: 3333 })).toBe(9999);
    expect(lineAmount({ quantity: 1.5, unitPrice: 333 })).toBe(500);
  });

  it("applies discount before tax and never discounts below zero", () => {
    const t = computeTotals([{ quantity: 2, unitPrice: 50000 }, { quantity: 1, unitPrice: 25000 }], 25000, 10);
    expect(t).toEqual({ subtotal: 125000, discount: 25000, taxAmount: 10000, total: 110000 });
    expect(computeTotals([{ quantity: 1, unitPrice: 1000 }], 5000, 0)).toEqual({ subtotal: 1000, discount: 1000, taxAmount: 0, total: 0 });
    expect(computeTotals([{ quantity: 1, unitPrice: 1000 }], -50, 0).discount).toBe(0);
  });

  it("derives status from payments", () => {
    expect(statusAfterPayments("sent", 1000, 0)).toBe("sent");
    expect(statusAfterPayments("draft", 1000, 0)).toBe("draft");
    expect(statusAfterPayments("sent", 1000, 400)).toBe("partial");
    expect(statusAfterPayments("partial", 1000, 1000)).toBe("paid");
    expect(statusAfterPayments("paid", 1000, 300)).toBe("partial"); // refund
    expect(statusAfterPayments("paid", 1000, 0)).toBe("sent");
    expect(statusAfterPayments("void", 1000, 1000)).toBe("void");
  });
});

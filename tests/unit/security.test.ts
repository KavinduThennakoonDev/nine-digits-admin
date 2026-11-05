import { describe, expect, it } from "vitest";
import { safeNext, loginSchema } from "@/features/auth/schemas";
import { resolvePermissions, ALL_PERMISSIONS } from "@/lib/permissions";
import { toCsv } from "@/server/services/export";
import { objectId } from "@/lib/fields";
import { escapeRegex } from "@/lib/list-params";

describe("post-login redirect", () => {
  it.each([
    ["/leads?status=open", "/leads?status=open"],
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["/\tevil", "/dashboard"],
    ["/login?next=/x", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, expected) => expect(safeNext(input)).toBe(expected));
});

describe("permissions", () => {
  it("applies grants and denies on top of the role", () => {
    const p = resolvePermissions("employee", ["leads.view", "tasks.view"], { grant: ["reports.view"], deny: ["tasks.view"] });
    expect(p.sort()).toEqual(["leads.view", "reports.view"]);
  });
  it("ignores unknown permission strings", () => {
    expect(resolvePermissions("x", ["leads.view", "root.everything"], { grant: ["sudo"] })).toEqual(["leads.view"]);
  });
  it("gives Super Admin everything regardless of overrides", () => {
    expect(resolvePermissions("super-admin", [], { deny: ["settings.manage"] }).length).toBe(ALL_PERMISSIONS.length);
  });
});

describe("input hardening", () => {
  it("rejects Mongo operator objects where ids are expected", () => {
    expect(objectId.safeParse({ $ne: null }).success).toBe(false);
    expect(objectId.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
    expect(loginSchema.safeParse({ email: { $gt: "" }, password: "x" }).success).toBe(false);
  });
  it("escapes regex metacharacters in search", () => {
    expect(new RegExp(escapeRegex("a.*(b")).test("a.*(b")).toBe(true);
    expect(new RegExp(escapeRegex(".*")).test("anything")).toBe(false);
  });
  it("neutralises spreadsheet formulas in CSV exports", () => {
    const csv = toCsv([{ header: "Name", value: (r: { n: string }) => r.n }], [{ n: "=HYPERLINK(\"http://x\")" }, { n: "+1" }, { n: "@SUM(A1)" }, { n: "Plain, \"quoted\"" }]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(lines[2]).toBe("'+1");
    expect(lines[3]).toBe("'@SUM(A1)");
    expect(lines[4]).toBe(`"Plain, ""quoted"""`);
  });
});

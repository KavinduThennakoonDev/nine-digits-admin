import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_STATUSES, closedStatusKeys, editableStatuses, normaliseLeadStatuses, statusKeyFrom, statusLabel, statusTone,
} from "@/lib/lead-statuses";
import { leadStatusesSchema } from "@/features/settings/schemas";

describe("lead statuses", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(normaliseLeadStatuses([])).toEqual(DEFAULT_LEAD_STATUSES);
    expect(normaliseLeadStatuses(undefined)).toEqual(DEFAULT_LEAD_STATUSES);
  });

  it("always keeps the built-in statuses and their rules", () => {
    const list = normaliseLeadStatuses([
      { key: "new", label: "Fresh", tone: "info", closed: true }, // "new" can't be closed
      { key: "proposal_sent", label: "Proposal sent", tone: "rainbow" as never, closed: false },
    ]);
    expect(list.map((s) => s.key)).toEqual(["new", "proposal_sent", "converted"]);
    expect(list[0]).toMatchObject({ label: "Fresh", closed: false });
    expect(list[1].tone).toBe("neutral"); // unknown colour
    expect(list[2].closed).toBe(true);
  });

  it("derives keys and lookups", () => {
    expect(statusKeyFrom("Proposal sent!")).toBe("proposal_sent");
    expect(statusKeyFrom("—")).toBe("status");
    expect(closedStatusKeys(DEFAULT_LEAD_STATUSES)).toEqual(["converted", "not_interested", "lost"]);
    expect(editableStatuses(DEFAULT_LEAD_STATUSES).some((s) => s.key === "converted")).toBe(false);
    expect(statusLabel(DEFAULT_LEAD_STATUSES, "follow_up")).toBe("Follow-up required");
    expect(statusLabel(DEFAULT_LEAD_STATUSES, "gone_away")).toBe("gone away"); // removed status still readable
    expect(statusTone(DEFAULT_LEAD_STATUSES, "lost")).toBe("danger");
  });

  it("rejects duplicate names in the settings form", () => {
    const r = leadStatusesSchema.safeParse({
      statuses: [
        { key: "new", label: "New", tone: "brand", closed: false },
        { key: "", label: "new ", tone: "info", closed: false },
        { key: "converted", label: "Converted", tone: "success", closed: true },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["statuses", 1, "label"]);
  });
});

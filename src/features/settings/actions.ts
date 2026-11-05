"use server";

import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { Settings } from "@/server/db/models/settings";
import { authorize } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { parse, runAction } from "@/server/action";
import type { ActionResult } from "@/lib/action-result";
import { getSettings } from "./queries";
import { agencySchema, currencySchema, leadStatusesSchema, type AgencyInput, type CurrencyInput, type LeadStatusesInput } from "./schemas";
import { Lead } from "@/server/db/models/lead";
import { LeadActivity } from "@/server/db/models/lead-activity";
import { withTransaction } from "@/server/db/transaction";
import { AppError } from "@/server/errors";
import { getLeadStatuses } from "@/server/services/lead-statuses";
import {
  CONVERTED_STATUS, NEW_STATUS, isSystemStatus, normaliseLeadStatuses, statusKeyFrom, statusLabel, type LeadStatusDef,
} from "@/lib/lead-statuses";

export async function updateAgencyAction(input: AgencyInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("settings.manage");
    const data = parse(agencySchema, input);
    const current = await getSettings();
    await connectDB();
    await Settings.updateOne({ key: "global" }, { $set: { agency: data, updatedBy: actor.id } });
    const d = diff(current.agency, data);
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "settings", summary: "Updated agency information", before: d.before, after: d.after });
    refresh();
    return null;
  });
}

export async function updateCurrencyAction(input: CurrencyInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("settings.manage");
    const data = parse(currencySchema, input);
    const current = await getSettings();
    await connectDB();

    const update: Record<string, unknown> = {
      $set: {
        "currency.base": data.base,
        "currency.usdToLkr": data.usdToLkr,
        "invoice.prefix": data.invoicePrefix,
        "invoice.defaultDueDays": data.defaultDueDays,
        updatedBy: actor.id,
      },
    };
    if (data.usdToLkr !== current.currency.usdToLkr) {
      update.$push = { "currency.rateHistory": { usdToLkr: data.usdToLkr, changedAt: new Date(), changedBy: actor.id } };
    }
    await Settings.updateOne({ key: "global" }, update);

    const d = diff(
      { base: current.currency.base, usdToLkr: current.currency.usdToLkr, invoicePrefix: current.invoice.prefix, defaultDueDays: current.invoice.defaultDueDays },
      data,
    );
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "settings", summary: "Updated currency & invoice settings", before: d.before, after: d.after });
    refresh();
    return null;
  });
}

/**
 * Saves the lead pipeline. Keys never change once created (leads store the key), so renaming is safe.
 * Removing a status moves its leads to the status chosen in `remap`, in the same transaction.
 */
export async function updateLeadStatusesAction(input: LeadStatusesInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("settings.manage");
    const data = parse(leadStatusesSchema, input);
    await connectDB();
    const current = await getLeadStatuses();
    const currentKeys = new Set(current.map((s) => s.key));

    // Assign keys to new statuses; ignore keys the client made up.
    const taken = new Set(currentKeys);
    const next: LeadStatusDef[] = data.statuses.map((s) => {
      let key = s.key && currentKeys.has(s.key) ? s.key : "";
      if (!key) {
        const base = statusKeyFrom(s.label);
        key = base;
        for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
        taken.add(key);
      }
      return { key, label: s.label.trim(), tone: s.tone, closed: s.closed };
    });
    if (new Set(next.map((s) => s.key)).size !== next.length) throw new AppError("VALIDATION", "Each status can appear only once.");
    for (const key of [NEW_STATUS, CONVERTED_STATUS]) {
      if (!next.some((s) => s.key === key)) throw new AppError("VALIDATION", `“${statusLabel(current, key)}” is built in and can't be removed.`);
    }
    if (next.every((s) => s.closed)) throw new AppError("VALIDATION", "Keep at least one open status.");
    const normalised = normaliseLeadStatuses(next);

    // Statuses being removed, and where their leads go.
    const removed = current.filter((s) => !next.some((n) => n.key === s.key));
    const moves: { from: LeadStatusDef; to: LeadStatusDef }[] = [];
    for (const r of removed) {
      if (isSystemStatus(r.key)) throw new AppError("VALIDATION", `“${r.label}” is built in and can't be removed.`);
      const inUse = await Lead.countDocuments({ status: r.key, deletedAt: null });
      const target = normalised.find((s) => s.key === data.remap[r.key]);
      if (inUse && (!target || target.key === CONVERTED_STATUS)) {
        throw new AppError("VALIDATION", `Choose where the ${inUse} lead${inUse === 1 ? "" : "s"} in “${r.label}” should move.`);
      }
      moves.push({ from: r, to: target ?? normalised.find((s) => s.key === NEW_STATUS)! });
    }

    const moved = await withTransaction(async (session) => {
      let total = 0;
      for (const { from, to } of moves) {
        const ids = (await Lead.find({ status: from.key }, { _id: 1 }, { session }).lean()).map((l) => l._id);
        if (!ids.length) continue;
        await Lead.updateMany({ _id: { $in: ids } }, { $set: { status: to.key, updatedBy: actor.id } }, { session });
        await LeadActivity.insertMany(ids.map((leadId) => ({
          leadId, type: "status_change", userId: actor.id,
          meta: { detail: `${from.label} → ${to.label} (status “${from.label}” was removed)`, from: from.key, to: to.key },
        })), { session });
        total += ids.length;
      }
      await Settings.updateOne({ key: "global" }, { $set: { leadStatuses: normalised, updatedBy: actor.id } }, { session, upsert: true });
      return total;
    });

    const summary = (list: LeadStatusDef[]) => list.map((s) => `${s.label}${s.closed ? " (closed)" : ""}`).join(", ");
    const before = summary(current), after = summary(normalised);
    if (before !== after || moved) {
      await audit({
        userId: actor.id, action: "update", module: "settings",
        summary: moved ? `Updated lead statuses (moved ${moved} lead${moved === 1 ? "" : "s"})` : "Updated lead statuses",
        before: { leadStatuses: before }, after: { leadStatuses: after },
      });
    }
    refresh();
    return null;
  });
}

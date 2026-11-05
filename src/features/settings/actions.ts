"use server";

import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { Settings } from "@/server/db/models/settings";
import { authorize } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { parse, runAction } from "@/server/action";
import type { ActionResult } from "@/lib/action-result";
import { getSettings } from "./queries";
import { agencySchema, currencySchema, type AgencyInput, type CurrencyInput } from "./schemas";

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

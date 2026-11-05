"use server";

import { refresh } from "next/cache";
import { connectDB } from "@/server/db/connect";
import { Service } from "@/server/db/models/service";
import { authorize } from "@/server/auth/dal";
import { audit, diff } from "@/server/services/audit";
import { AppError } from "@/server/errors";
import { parse, runAction } from "@/server/action";
import { amountToMinor } from "@/lib/fields";
import type { ActionResult } from "@/lib/action-result";
import { serviceSchema, type ServiceInput } from "./schemas";

export async function saveServiceAction(input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("services.manage");
    const data = parse(serviceSchema, input);
    await connectDB();
    const doc = {
      name: data.name,
      category: data.category,
      description: data.description,
      billing: data.billing,
      basePrice: { amount: amountToMinor(data.price) ?? 0, currency: data.currency },
      isActive: data.isActive,
      updatedBy: actor.id,
    };

    const clash = await Service.findOne({ name: data.name, ...(data.id ? { _id: { $ne: data.id } } : {}) })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (clash) throw new AppError("CONFLICT", "A service with this name already exists.", { name: ["A service with this name already exists."] });

    if (!data.id) {
      const created = await Service.create({ ...doc, createdBy: actor.id });
      await audit({ userId: actor.id, action: "create", module: "services", recordId: String(created._id), summary: `Created service ${data.name}`, after: { name: data.name } });
      refresh();
      return { id: String(created._id) };
    }

    const existing = await Service.findById(data.id);
    if (!existing) throw new AppError("NOT_FOUND", "Service not found.");
    const before = { name: existing.name, category: existing.category, billing: existing.billing, price: existing.basePrice?.amount, currency: existing.basePrice?.currency, isActive: existing.isActive };
    existing.set(doc);
    await existing.save();
    const d = diff(before, { name: doc.name, category: doc.category, billing: doc.billing, price: doc.basePrice.amount, currency: doc.basePrice.currency, isActive: doc.isActive });
    if (d.changed) await audit({ userId: actor.id, action: "update", module: "services", recordId: data.id, summary: `Updated service ${data.name}`, before: d.before, after: d.after });
    refresh();
    return { id: data.id };
  });
}

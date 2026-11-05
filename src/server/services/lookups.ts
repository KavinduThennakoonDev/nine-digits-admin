import "server-only";
import { connectDB } from "../db/connect";
import { User } from "../db/models/user";
import { Service } from "../db/models/service";
import type { ComboOption } from "@/components/forms/combobox";

/** Active team members for "assigned to" pickers. Callers must be signed in. */
export async function getUserOptions(): Promise<ComboOption[]> {
  await connectDB();
  const users = await User.find({ status: "active" }, { name: 1, jobTitle: 1 }).sort({ name: 1 }).lean();
  return users.map((u) => ({ value: String(u._id), label: u.name, hint: u.jobTitle || undefined }));
}

/** Active services for pickers (plus any inactive ones still referenced by `include`). */
export async function getServiceOptions(include: string[] = []): Promise<ComboOption[]> {
  await connectDB();
  const services = await Service.find({ $or: [{ isActive: true }, { _id: { $in: include } }] }, { name: 1, category: 1, isActive: 1 })
    .sort({ name: 1 })
    .lean();
  return services.map((s) => ({ value: String(s._id), label: s.isActive ? s.name : `${s.name} (inactive)`, hint: s.category || undefined }));
}

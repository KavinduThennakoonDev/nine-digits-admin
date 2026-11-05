import "server-only";
import { connectDB } from "@/server/db/connect";
import { Service } from "@/server/db/models/service";
import { Client } from "@/server/db/models/client";
import { Lead } from "@/server/db/models/lead";
import { authorize } from "@/server/auth/dal";
import type { Currency, ServiceBilling } from "@/lib/constants";

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  billing: ServiceBilling;
  priceMinor: number;
  currency: Currency;
  isActive: boolean;
  clientCount: number;
  leadCount: number;
};

export async function listServices(): Promise<ServiceRow[]> {
  await authorize("services.view");
  await connectDB();
  const [services, clientCounts, leadCounts] = await Promise.all([
    Service.find().sort({ isActive: -1, name: 1 }).lean(),
    Client.aggregate<{ _id: unknown; n: number }>([
      { $match: { deletedAt: null, archivedAt: null } },
      { $unwind: "$serviceIds" },
      { $group: { _id: "$serviceIds", n: { $sum: 1 } } },
    ]),
    Lead.aggregate<{ _id: unknown; n: number }>([
      { $match: { deletedAt: null, interestedServiceId: { $ne: null } } },
      { $group: { _id: "$interestedServiceId", n: { $sum: 1 } } },
    ]),
  ]);
  const cMap = new Map(clientCounts.map((c) => [String(c._id), c.n]));
  const lMap = new Map(leadCounts.map((c) => [String(c._id), c.n]));
  return services.map((s) => ({
    id: String(s._id),
    name: s.name,
    category: s.category ?? "",
    description: s.description ?? "",
    billing: s.billing as ServiceBilling,
    priceMinor: s.basePrice?.amount ?? 0,
    currency: (s.basePrice?.currency ?? "LKR") as Currency,
    isActive: s.isActive ?? true,
    clientCount: cMap.get(String(s._id)) ?? 0,
    leadCount: lMap.get(String(s._id)) ?? 0,
  }));
}

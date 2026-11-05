import "server-only";
import { cache } from "react";
import { connectDB } from "../db/connect";
import { Settings } from "../db/models/settings";
import { closedStatusKeys, normaliseLeadStatuses, type LeadStatusDef } from "@/lib/lead-statuses";

/** The configured lead statuses, in display order. Read once per request. */
export const getLeadStatuses = cache(async (): Promise<LeadStatusDef[]> => {
  await connectDB();
  const s = await Settings.findOne({ key: "global" }, { leadStatuses: 1 }).lean();
  return normaliseLeadStatuses(s?.leadStatuses as Partial<LeadStatusDef>[] | undefined);
});

/** Keys of statuses that mean the lead is finished. */
export async function getClosedLeadStatuses(): Promise<string[]> {
  return closedStatusKeys(await getLeadStatuses());
}

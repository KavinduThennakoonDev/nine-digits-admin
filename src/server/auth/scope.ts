import "server-only";
import { Types } from "mongoose";
import { can, type CurrentUser } from "./dal";
import type { Permission } from "@/lib/permissions";

/**
 * Row-level visibility: people without the "view all" permission only see
 * records assigned to them.
 */
export function assignedScope(user: CurrentUser, viewAll: Permission): Record<string, unknown> {
  return can(user, viewAll) ? {} : { assignedTo: new Types.ObjectId(user.id) };
}

export function canSeeAssigned(user: CurrentUser, viewAll: Permission, assignedTo: unknown): boolean {
  return can(user, viewAll) || String(assignedTo ?? "") === user.id;
}

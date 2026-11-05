import "server-only";
import type { CurrentUser } from "@/server/auth/dal";
import { getUserOptions } from "@/server/services/lookups";
import { getClientOptionsForFinance } from "@/features/invoices/queries";
import { getProjectOptions } from "@/features/projects/queries";
import type { TaskFormOptions } from "./components/task-form-sheet";

/** Picker data for task forms (people, projects, clients). */
export async function getTaskFormOptions(user: CurrentUser, includeProjectIds: string[] = []): Promise<TaskFormOptions> {
  const [users, projects, clients] = await Promise.all([getUserOptions(), getProjectOptions(user, includeProjectIds), getClientOptionsForFinance()]);
  return { users, projects, clients };
}

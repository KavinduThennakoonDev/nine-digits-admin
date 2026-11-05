import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { can, requireUser } from "@/server/auth/dal";
import { countOpenTasks, listTaskBoard, listTasks } from "@/features/tasks/queries";
import { getTaskFormOptions } from "@/features/tasks/options";
import { TasksView } from "@/features/tasks/components/tasks-view";
import { first } from "@/lib/list-params";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "tasks.view")) return <AccessDenied />;
  const sp = await searchParams;
  const view = first(sp.view) === "board" ? "board" : "list";
  const [list, board, options, counts] = await Promise.all([
    view === "list" ? listTasks(sp) : null,
    view === "board" ? listTaskBoard(sp) : null,
    getTaskFormOptions(user),
    countOpenTasks(user),
  ]);
  return <PageContainer className="max-w-none"><TasksView view={view} list={list} board={board} options={options} counts={counts} /></PageContainer>;
}

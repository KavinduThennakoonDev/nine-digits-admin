import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "./page-skeleton";

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 p-1">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-4 w-32" />
        </div>
        <PageSkeleton />
      </div>
    </div>
  );
}

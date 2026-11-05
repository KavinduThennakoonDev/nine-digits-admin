import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "./page-header";

export function PageSkeleton({ variant = "table" }: { variant?: "table" | "cards" | "form" }) {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}
      {variant === "form" ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-24" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

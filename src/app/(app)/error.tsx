"use client";

import { PageContainer } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <ErrorState reset={reset} />
      {error.digest ? <p className="text-center text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
    </PageContainer>
  );
}

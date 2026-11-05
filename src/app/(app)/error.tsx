"use client";

import { PageContainer } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <ErrorState reset={reset} />
    </PageContainer>
  );
}

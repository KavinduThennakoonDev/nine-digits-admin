"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

export function ErrorState({ reset, message }: { reset?: () => void; message?: string }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description={message ?? "We couldn't load this content. Check your connection and try again."}
      action={reset ? <Button variant="outline" onClick={reset}>Try again</Button> : undefined}
    />
  );
}

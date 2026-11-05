import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "./empty-state";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description={message ?? "Ask a Super Admin to update your role's permissions if you need access."}
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}

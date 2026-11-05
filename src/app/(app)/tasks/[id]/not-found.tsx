import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function NotFoundPage() {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <EmptyState icon={SearchX} title="Task not found" description="It may have been deleted, or you don&apos;t have access to it."
        action={<Button asChild variant="outline"><Link href="/tasks">Back to tasks</Link></Button>} />
    </PageContainer>
  );
}

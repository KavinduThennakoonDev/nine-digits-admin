import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function TableNotFound() {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <EmptyState icon={SearchX} title="Table not found" description="It may have been deleted, or it isn&apos;t shared with you."
        action={<Button asChild variant="outline"><Link href="/tables">Back to tables</Link></Button>} />
    </PageContainer>
  );
}

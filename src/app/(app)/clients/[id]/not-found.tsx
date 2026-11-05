import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function ClientNotFound() {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <EmptyState icon={SearchX} title="Client not found" description="It may have been deleted, or it isn't assigned to you."
        action={<Button asChild variant="outline"><Link href="/clients">Back to clients</Link></Button>} />
    </PageContainer>
  );
}

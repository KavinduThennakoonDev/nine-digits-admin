import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export default function InvoiceNotFound() {
  return (
    <PageContainer className="min-h-[60vh] justify-center">
      <EmptyState icon={SearchX} title="Invoice not found" description="It may have been a draft that was deleted."
        action={<Button asChild variant="outline"><Link href="/finance/invoices">Back to invoices</Link></Button>} />
    </PageContainer>
  );
}

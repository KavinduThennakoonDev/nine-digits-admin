import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <EmptyState icon={SearchX} title="Page not found" description="The page you're looking for doesn't exist or has moved."
        action={<Button asChild variant="outline"><Link href="/dashboard">Go to dashboard</Link></Button>} />
    </main>
  );
}

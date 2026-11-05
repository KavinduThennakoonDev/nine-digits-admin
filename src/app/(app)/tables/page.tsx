import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/components/feedback/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { can, requireUser } from "@/server/auth/dal";
import { listTables } from "@/features/tables/queries";
import { TableIconView } from "@/features/tables/components/table-icon";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Custom tables" };

export default async function TablesPage() {
  const user = await requireUser();
  if (!can(user, "tables.view")) return <AccessDenied />;
  const canManage = can(user, "tables.manage");
  const tables = await listTables(user, { includeArchived: canManage });
  const create = canManage ? <Button asChild><Link href="/tables/new"><Plus /> Create table</Link></Button> : null;
  return (
    <PageContainer>
      <PageHeader title="Custom tables" description="Your own data tables — build the fields, then collect records. No code needed." actions={create} />
      {tables.length === 0 ? (
        <EmptyState icon={Table2} title="No tables yet"
          description={canManage ? "Create a table for anything you track: tourist contacts, event RSVPs, influencer lists…" : "Tables your team shares with you will appear here."}
          action={create ?? undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((t) => (
            <Link key={t.id} href={`/tables/${t.slug}`} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Card className={`h-full gap-3 transition-colors group-hover:border-primary/40 ${t.archivedAt ? "opacity-70" : ""}`}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><TableIconView icon={t.icon} className="size-4" /></span>
                    <CardTitle className="truncate">{t.name}</CardTitle>
                    {t.archivedAt ? <StatusBadge tone="warning" dot={false}>Archived</StatusBadge> : null}
                  </div>
                  <CardDescription className="line-clamp-2 min-h-10">{t.description || `${t.fieldCount} fields`}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                  <span><span className="tabular font-medium text-foreground">{t.recordCount.toLocaleString()}</span> records · {t.fieldCount} fields</span>
                  <span>{t.level === "view" ? "View only · " : ""}updated {timeAgo(t.updatedAt)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

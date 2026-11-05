"use client";

import { useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { useCan } from "@/components/providers/session-provider";
import { labelOf, SERVICE_BILLING_OPTIONS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { ServiceRow } from "../queries";
import { ServiceSheet } from "./service-sheet";

export function ServicesView({ services }: { services: ServiceRow[] }) {
  const can = useCan();
  const canManage = can("services.manage");
  const [sheet, setSheet] = useState<{ open: boolean; service: ServiceRow | null }>({ open: false, service: null });

  return (
    <>
      <PageHeader
        title="Services"
        description="What the agency sells. Assign services to clients and track what leads are interested in."
        actions={canManage ? <Button onClick={() => setSheet({ open: true, service: null })}><Plus /> New service</Button> : null}
      />
      {services.length === 0 ? (
        <EmptyState icon={Briefcase} title="No services yet" description="Add the services you offer so they can be assigned to clients and leads."
          action={canManage ? <Button onClick={() => setSheet({ open: true, service: null })}><Plus /> New service</Button> : undefined} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground">Service</TableHead>
                <TableHead className="text-xs text-muted-foreground">Billing</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">Base price</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">Clients</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">Leads</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">Invoiced</TableHead>
                <TableHead className="text-xs text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id} className={canManage ? "cursor-pointer" : undefined}
                  onClick={canManage ? () => setSheet({ open: true, service: s }) : undefined}>
                  <TableCell className="py-2.5">
                    <p className="font-medium">{s.name}</p>
                    <p className="max-w-md truncate text-xs text-muted-foreground">{s.category || s.description || "—"}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{labelOf(SERVICE_BILLING_OPTIONS, s.billing)}</TableCell>
                  <TableCell className="tabular text-right">{s.priceMinor ? formatMoney(s.priceMinor, s.currency) : "—"}</TableCell>
                  <TableCell className="tabular text-right">{s.clientCount}</TableCell>
                  <TableCell className="tabular text-right">{s.leadCount}</TableCell>
                  <TableCell className="tabular text-right">{s.invoicedBase ? formatMoney(s.invoicedBase, s.base) : "—"}</TableCell>
                  <TableCell>{s.isActive ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge>Inactive</StatusBadge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ServiceSheet open={sheet.open} service={sheet.service} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
    </>
  );
}

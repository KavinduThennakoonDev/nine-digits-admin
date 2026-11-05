"use client";

import { UrlStateProvider, useUrlState } from "@/components/data-table/url-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LABELS = { invoices: "Invoices", payments: "Payments", expenses: "Expenses" } as const;
export type BillingTab = keyof typeof LABELS;

function Inner({ tabs, active, children }: { tabs: BillingTab[]; active: BillingTab; children: React.ReactNode }) {
  const url = useUrlState();
  return (
    <Tabs value={active} onValueChange={(v) => url.set({ tab: v === tabs[0] ? null : v, q: null, status: null, period: null, method: null, category: null, sort: null, dir: null })}>
      <TabsList>{tabs.map((t) => <TabsTrigger key={t} value={t}>{LABELS[t]}</TabsTrigger>)}</TabsList>
      <div className="mt-4">{children}</div>
    </Tabs>
  );
}

/** Tab strip bound to ?tab=; only the active tab's content is rendered (and fetched) on the server. */
export function BillingTabs(props: { tabs: BillingTab[]; active: BillingTab; children: React.ReactNode }) {
  return <UrlStateProvider><Inner {...props} /></UrlStateProvider>;
}

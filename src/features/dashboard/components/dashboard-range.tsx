"use client";

import { UrlStateProvider } from "@/components/data-table/url-state";
import { DateRangeFilter } from "@/components/data-table/date-range-filter";

export function DashboardRange() {
  return <UrlStateProvider><DateRangeFilter fallback="this_month" /></UrlStateProvider>;
}

"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Ctx = {
  pending: boolean;
  get: (key: string) => string | null;
  /** Set (or with null, remove) params. Resets to page 1 unless `page` is part of the patch. */
  set: (patch: Record<string, string | number | null | undefined>) => void;
};

const UrlStateContext = createContext<Ctx | null>(null);

export function UrlStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback<Ctx["set"]>(
    (patch) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  return (
    <UrlStateContext value={{ pending, get: (k) => searchParams.get(k), set }}>{children}</UrlStateContext>
  );
}

export function useUrlState() {
  const ctx = useContext(UrlStateContext);
  if (!ctx) throw new Error("useUrlState must be used inside <UrlStateProvider>");
  return ctx;
}

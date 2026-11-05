import { z } from "zod";

export type SearchParams = Record<string, string | string[] | undefined>;

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const baseList = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().refine((n) => [10, 20, 50, 100].includes(n)).catch(20),
  q: z.string().trim().max(100).catch(""),
  sort: z.string().regex(/^[a-zA-Z0-9_.]+$/).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type ListParams = z.output<typeof baseList>;

/** Parse common list params (page, pageSize, q, sort, dir) from URL search params. */
export function parseListParams(sp: SearchParams, sortable: readonly string[], defaultSort: string): ListParams & { sort: string } {
  const parsed = baseList.parse({
    page: first(sp.page),
    pageSize: first(sp.pageSize),
    q: first(sp.q) ?? "",
    sort: first(sp.sort),
    dir: first(sp.dir),
  });
  return { ...parsed, sort: parsed.sort && sortable.includes(parsed.sort) ? parsed.sort : defaultSort };
}

export type Paginated<T> = { rows: T[]; total: number; page: number; pageSize: number; pageCount: number };

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

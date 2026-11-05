"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, FileUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { parseCsv } from "@/lib/csv";
import { FIELD_TYPE_META, type FieldDef } from "@/lib/dynamic/types";
import { importRecordsAction, type ImportReport } from "../record-actions";

const SKIP = "__skip";
const MAX_ROWS = 5000;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function ImportDialog({ open, onOpenChange, tableId, fields }: { open: boolean; onOpenChange: (o: boolean) => void; tableId: string; fields: FieldDef[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>The first row must be column headers. Up to {MAX_ROWS.toLocaleString()} rows per import.</DialogDescription>
        </DialogHeader>
        {open ? <Importer tableId={tableId} fields={fields} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Importer({ tableId, fields, onDone }: { tableId: string; fields: FieldDef[]; onDone: () => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onFile = async (file: File | undefined) => {
    setError(""); setReport(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError("That file is larger than 10 MB.");
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) return setError("The file needs a header row and at least one data row.");
    const [head, ...body] = parsed;
    if (body.length > MAX_ROWS) return setError(`That file has ${body.length.toLocaleString()} rows. Split it into files of ${MAX_ROWS.toLocaleString()} or fewer.`);
    setFileName(file.name);
    setHeaders(head);
    setRows(body);
    // Auto-map columns whose header matches a field label or key.
    const auto: Record<string, string> = {};
    head.forEach((h, i) => {
      const f = fields.find((x) => norm(x.label) === norm(h) || norm(x.key) === norm(h));
      if (f && !Object.values(auto).includes(f.id)) auto[String(i)] = f.id;
    });
    setMapping(auto);
  };

  const mappedCount = Object.values(mapping).filter((v) => v && v !== SKIP).length;
  const unmappedRequired = useMemo(
    () => fields.filter((f) => f.required && !Object.values(mapping).includes(f.id) && f.defaultValue === "" ),
    [fields, mapping],
  );
  const run = (dryRun: boolean) => startTransition(async () => {
    const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v && v !== SKIP));
    const r = await importRecordsAction({ tableId, mapping: clean, rows, dryRun });
    if (!r.ok) return void toast.error(r.error.message);
    setReport(r.data);
    if (!dryRun) {
      toast.success(`Imported ${r.data.imported} record${r.data.imported === 1 ? "" : "s"}${r.data.invalid ? `, skipped ${r.data.invalid}` : ""}.`);
      onDone();
    }
  });

  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm transition-colors hover:bg-muted/40">
          <FileUp className="size-6 text-muted-foreground" />
          <span className="font-medium">{fileName || "Choose a CSV file"}</span>
          <span className="text-xs text-muted-foreground">{fileName ? `${rows.length.toLocaleString()} rows · ${headers.length} columns` : "Exported from Excel, Google Sheets or another system"}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        {headers.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Match columns to fields</h3>
            <ul className="divide-y rounded-lg border">
              {headers.map((h, i) => (
                <li key={i} className="grid grid-cols-[1fr_1fr] items-center gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{h || `Column ${i + 1}`}</p>
                    <p className="truncate text-xs text-muted-foreground">e.g. {rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <Select value={mapping[String(i)] ?? SKIP} onValueChange={(v) => { setReport(null); setMapping((m) => ({ ...m, [String(i)]: v })); }}>
                    <SelectTrigger size="sm" className="w-full" aria-label={`Field for column ${h || i + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>Don&apos;t import</SelectItem>
                      {fields.map((f) => (
                        <SelectItem key={f.id} value={f.id} disabled={Object.entries(mapping).some(([c, v]) => v === f.id && c !== String(i))}>
                          {f.label} <span className="text-xs text-muted-foreground">{FIELD_TYPE_META[f.type].label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            {unmappedRequired.length ? (
              <p className="text-xs text-muted-foreground">Required and not mapped: {unmappedRequired.map((f) => f.label).join(", ")} — rows will fail validation.</p>
            ) : null}
          </div>
        ) : null}

        {report ? (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              {report.invalid ? <TriangleAlert className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}
              {report.valid.toLocaleString()} of {report.total.toLocaleString()} rows are valid
            </p>
            {report.errors.length ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {report.errors.map((e) => <li key={e.row}><span className="font-medium">Row {e.row}:</span> {e.messages.join("; ")}</li>)}
              </ul>
            ) : null}
            {report.invalid ? <p className="text-xs text-muted-foreground">Invalid rows are skipped. Fix them in the file and import again.</p> : null}
          </div>
        ) : null}
      </div>
      <DialogFooter className="border-t p-4">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        {!report ? (
          <Button disabled={!rows.length || !mappedCount || pending} onClick={() => run(true)}>{pending ? <Spinner /> : null} Validate {rows.length ? rows.length.toLocaleString() : ""} rows</Button>
        ) : (
          <Button disabled={!report.valid || pending} onClick={() => run(false)}>{pending ? <Spinner /> : null} Import {report.valid.toLocaleString()} valid row{report.valid === 1 ? "" : "s"}</Button>
        )}
      </DialogFooter>
    </>
  );
}

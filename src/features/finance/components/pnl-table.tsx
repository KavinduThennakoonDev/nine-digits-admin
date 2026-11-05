import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Currency } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PnlRow } from "../queries";

export function PnlTable({ rows, base }: { rows: PnlRow[]; base: Currency }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs text-muted-foreground">Period</TableHead>
            <TableHead className="text-right text-xs text-muted-foreground">Revenue</TableHead>
            <TableHead className="text-right text-xs text-muted-foreground">Expenses</TableHead>
            <TableHead className="text-right text-xs text-muted-foreground">Net profit</TableHead>
            <TableHead className="text-right text-xs text-muted-foreground">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className={cn(r.kind === "quarter" && "bg-muted/30 font-medium", r.kind === "year" && "bg-muted/60 font-semibold")}>
              <TableCell className={cn(r.kind === "month" && "pl-6 text-muted-foreground")}>{r.label}</TableCell>
              <TableCell className="tabular text-right">{formatMoney(r.revenue, base)}</TableCell>
              <TableCell className="tabular text-right">{formatMoney(r.expenses, base)}</TableCell>
              <TableCell className={cn("tabular text-right", r.profit < 0 && "text-destructive")}>{formatMoney(r.profit, base)}</TableCell>
              <TableCell className="tabular text-right text-muted-foreground">{r.revenue ? `${Math.round((r.profit / r.revenue) * 100)}%` : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { LogoMark } from "@/components/brand/logo";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { InvoiceDetail } from "../queries";

/** The printable invoice. Uses neutral colours so it prints cleanly in either theme. */
export function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  const { agency, client, currency } = invoice;
  const money = (v: number) => formatMoney(v, currency);
  return (
    <article className="rounded-xl border bg-card p-6 text-card-foreground sm:p-10 print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark size={44} />
          <div className="text-sm">
            <p className="text-base font-semibold">{agency.legalName || agency.name}</p>
            {agency.address ? <p className="whitespace-pre-line text-muted-foreground">{agency.address}</p> : null}
            <p className="text-muted-foreground">{[agency.email, agency.phone].filter(Boolean).join(" · ")}</p>
            {agency.taxId ? <p className="text-muted-foreground">Reg/Tax ID: {agency.taxId}</p> : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-semibold tracking-tight">{invoice.status === "void" ? "VOID INVOICE" : "Invoice"}</p>
          <p className="font-mono text-sm text-muted-foreground">{invoice.number}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Bill to</p>
          <p className="mt-1 font-medium">{client.companyName || client.clientName}</p>
          {client.contactPerson ? <p>{client.contactPerson}</p> : null}
          {client.address ? <p className="whitespace-pre-line text-muted-foreground">{client.address}</p> : null}
          {client.country ? <p className="text-muted-foreground">{client.country}</p> : null}
          {client.email ? <p className="text-muted-foreground">{client.email}</p> : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 sm:justify-self-end">
          <dt className="text-muted-foreground">Issue date</dt><dd className="sm:text-right">{formatDay(invoice.issueDate)}</dd>
          <dt className="text-muted-foreground">Due date</dt><dd className="sm:text-right">{formatDay(invoice.dueDate)}</dd>
          <dt className="text-muted-foreground">Currency</dt><dd className="sm:text-right">{currency}</dd>
        </dl>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((l, i) => (
            <tr key={i} className="border-b align-top">
              <td className="py-3 pr-4 whitespace-pre-wrap">{l.description}</td>
              <td className="tabular py-3 text-right">{l.quantity}</td>
              <td className="tabular py-3 text-right">{money(l.unitPrice)}</td>
              <td className="tabular py-3 text-right">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="tabular text-right">{money(invoice.subtotal)}</dd>
        {invoice.discount ? <><dt className="text-muted-foreground">Discount</dt><dd className="tabular text-right">−{money(invoice.discount)}</dd></> : null}
        {invoice.taxAmount ? <><dt className="text-muted-foreground">Tax ({invoice.taxRate}%)</dt><dd className="tabular text-right">{money(invoice.taxAmount)}</dd></> : null}
        <dt className="border-t pt-2 font-semibold">Total</dt><dd className="tabular border-t pt-2 text-right font-semibold">{money(invoice.total)}</dd>
        {invoice.amountPaid ? <><dt className="text-muted-foreground">Paid</dt><dd className="tabular text-right">−{money(invoice.amountPaid)}</dd></> : null}
        {invoice.status !== "void" ? <><dt className="font-semibold">Balance due</dt><dd className="tabular text-right font-semibold">{money(invoice.balance)}</dd></> : null}
      </dl>

      {invoice.notes || invoice.terms ? (
        <div className="mt-10 grid gap-6 border-t pt-6 text-sm sm:grid-cols-2">
          {invoice.notes ? <div><p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p><p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p></div> : null}
          {invoice.terms ? <div><p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Terms</p><p className="mt-1 whitespace-pre-wrap">{invoice.terms}</p></div> : null}
        </div>
      ) : null}
    </article>
  );
}

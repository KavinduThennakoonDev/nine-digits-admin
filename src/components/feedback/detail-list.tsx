import { cn } from "@/lib/utils";

/** Label/value rows for detail cards. Empty values render as an em dash. */
export function DetailList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y text-sm", className)}>
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value === "" || i.value === null || i.value === undefined ? <span className="text-muted-foreground">—</span> : i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const digits = (v: string) => v.replace(/[^\d]/g, "");

export function EmailLink({ email }: { email: string }) {
  return email ? <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a> : null;
}
export function PhoneLink({ phone }: { phone: string }) {
  return phone ? <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:underline">{phone}</a> : null;
}
export function WhatsAppLink({ phone }: { phone: string }) {
  return phone ? (
    <a href={`https://wa.me/${digits(phone)}`} target="_blank" rel="noreferrer" className="text-success hover:underline">{phone}</a>
  ) : null;
}

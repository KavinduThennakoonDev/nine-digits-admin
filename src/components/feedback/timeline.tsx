import {
  ArrowRightLeft, CircleDot, Handshake, Mail, MessageCircle, Phone, StickyNote, UserCheck, Users, type LucideIcon,
} from "lucide-react";
import { formatDateTime, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  kind: string;
  at: string;
  userName: string | null;
  body: string;
  detail?: string;
  badge?: string;
};

const KINDS: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  call: { icon: Phone, label: "Call", tone: "bg-chart-2/12 text-chart-2" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", tone: "bg-success/12 text-success" },
  email: { icon: Mail, label: "Email", tone: "bg-chart-5/12 text-chart-5" },
  meeting: { icon: Users, label: "Meeting", tone: "bg-chart-4/15 text-chart-4" },
  note: { icon: StickyNote, label: "Note", tone: "bg-muted text-muted-foreground" },
  status_change: { icon: ArrowRightLeft, label: "Status", tone: "bg-primary/12 text-primary" },
  assignment: { icon: UserCheck, label: "Assignment", tone: "bg-muted text-muted-foreground" },
  conversion: { icon: Handshake, label: "Converted", tone: "bg-success/12 text-success" },
  system: { icon: CircleDot, label: "Update", tone: "bg-muted text-muted-foreground" },
};

export function Timeline({ items, empty }: { items: TimelineItem[]; empty?: React.ReactNode }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {items.map((item) => {
        const k = KINDS[item.kind] ?? KINDS.system;
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", k.tone)}>
              <k.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-medium">{k.label}</span>
                {item.detail ? <span className="text-muted-foreground">· {item.detail}</span> : null}
                {item.badge ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{item.badge}</span> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                <span title={formatDateTime(item.at)}>{relative(item.at)}</span>
                {item.userName ? <> · {item.userName}</> : null}
              </p>
              {item.body ? <p className="mt-1.5 text-sm whitespace-pre-wrap">{item.body}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

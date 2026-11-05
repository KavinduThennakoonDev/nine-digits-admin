import { AlarmClock, Bell, CalendarClock, CheckSquare, FileWarning, Target, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import type { NotificationType } from "@/lib/constants";

const ICONS: Record<NotificationType, LucideIcon> = {
  lead_new: Target, lead_assigned: UserPlus, followup_due: CalendarClock, followup_overdue: AlarmClock,
  payment_received: Wallet, invoice_overdue: FileWarning, project_deadline: CalendarClock, task_assigned: CheckSquare,
};
const DANGER: NotificationType[] = ["followup_overdue", "invoice_overdue"];

export function NotificationIcon({ type }: { type: NotificationType }) {
  const Icon = ICONS[type] ?? Bell;
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${DANGER.includes(type) ? "bg-destructive/10 text-destructive" : type === "payment_received" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
      <Icon className="size-4" />
    </span>
  );
}

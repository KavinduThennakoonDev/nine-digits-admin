import { Briefcase, Calendar, Camera, ClipboardList, Map, Megaphone, Package, Phone, Plane, Star, Table2, Users, type LucideIcon } from "lucide-react";
import type { TableIcon } from "@/lib/dynamic/types";

export const TABLE_ICON_MAP: Record<TableIcon, LucideIcon> = {
  table: Table2, users: Users, plane: Plane, phone: Phone, megaphone: Megaphone, calendar: Calendar,
  clipboard: ClipboardList, star: Star, map: Map, package: Package, camera: Camera, briefcase: Briefcase,
};

export function TableIconView({ icon, className }: { icon: TableIcon; className?: string }) {
  const Icon = TABLE_ICON_MAP[icon] ?? Table2;
  return <Icon className={className} />;
}

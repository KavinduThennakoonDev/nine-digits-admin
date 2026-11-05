import { Briefcase, Building2, ChartNoAxesCombined, FileText, LayoutDashboard, Receipt, Settings, ShieldCheck, Target, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = { title: string; href: string; icon: LucideIcon; permission?: Permission; keywords?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

/** Modules are added here as each phase ships — no placeholder entries. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view", keywords: ["home", "stats"] }],
  },
  {
    label: "CRM",
    items: [
      { title: "Leads", href: "/leads", icon: Target, permission: "leads.view", keywords: ["enquiries", "prospects", "follow-ups", "calls"] },
      { title: "Clients", href: "/clients", icon: Building2, permission: "clients.view", keywords: ["customers", "accounts"] },
      { title: "Services", href: "/services", icon: Briefcase, permission: "services.view", keywords: ["offerings", "pricing"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Overview", href: "/finance", icon: ChartNoAxesCombined, permission: "finance.view", keywords: ["revenue", "profit", "p&l", "reports"] },
      { title: "Invoices", href: "/finance/invoices", icon: FileText, permission: "invoices.view", keywords: ["billing", "bills"] },
      { title: "Payments", href: "/finance/payments", icon: Wallet, permission: "payments.view", keywords: ["income", "received", "refunds"] },
      { title: "Expenses", href: "/finance/expenses", icon: Receipt, permission: "expenses.view", keywords: ["costs", "spending"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users", href: "/settings/users", icon: Users, permission: "users.view", keywords: ["team", "employees", "accounts"] },
      { title: "Roles & Permissions", href: "/settings/roles", icon: ShieldCheck, permission: "users.view", keywords: ["rbac", "access"] },
      { title: "Settings", href: "/settings/agency", icon: Settings, permission: "settings.manage", keywords: ["agency", "currency", "invoice"] },
    ],
  },
];

/** Extra titles for breadcrumbs that aren't top-level nav items. */
export const ROUTE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  settings: "Settings",
  users: "Users",
  roles: "Roles & Permissions",
  agency: "Agency",
  account: "Account",
  clients: "Clients",
  leads: "Leads",
  services: "Services",
  finance: "Finance",
  invoices: "Invoices",
  payments: "Payments",
  expenses: "Expenses",
  new: "New",
  edit: "Edit",
};

export function visibleNav(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || permissions.includes(i.permission)),
  })).filter((g) => g.items.length > 0);
}

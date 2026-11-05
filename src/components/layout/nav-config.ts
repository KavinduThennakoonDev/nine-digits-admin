import { BarChart3, Bell, Briefcase, Building2, ChartNoAxesCombined, CheckSquare, FileText, FolderKanban, History, LayoutDashboard, Receipt, Settings, ShieldCheck, Table2, Target, UserRoundSearch, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = { title: string; href: string; icon: LucideIcon; permission?: Permission; keywords?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

/** Modules are added here as each phase ships — no placeholder entries. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view", keywords: ["home", "stats"] },
      { title: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view", keywords: ["analytics", "export", "performance", "p&l"] },
      { title: "Notifications", href: "/notifications", icon: Bell, keywords: ["alerts", "reminders"] },
    ],
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
    label: "Work",
    items: [
      { title: "Projects", href: "/projects", icon: FolderKanban, permission: "projects.view", keywords: ["campaigns", "jobs"] },
      { title: "Tasks", href: "/tasks", icon: CheckSquare, permission: "tasks.view", keywords: ["todo", "board", "kanban"] },
      { title: "Team", href: "/team", icon: UserRoundSearch, permission: "employees.view", keywords: ["employees", "staff", "people"] },
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
    label: "Custom tables",
    items: [{ title: "All tables", href: "/tables", icon: Table2, permission: "tables.view", keywords: ["custom", "data", "builder"] }],
  },
  {
    label: "Administration",
    items: [
      { title: "Activity log", href: "/activity", icon: History, permission: "activity.view", keywords: ["audit", "history", "changes"] },
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
  tables: "Custom tables",
  projects: "Projects",
  tasks: "Tasks",
  team: "Team",
  notifications: "Notifications",
  activity: "Activity log",
  reports: "Reports",
  edit: "Edit",
};

export function visibleNav(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.permission || permissions.includes(i.permission)),
  })).filter((g) => g.items.length > 0);
}

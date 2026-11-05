/**
 * Permission catalog — the single source of truth for every permission key.
 * Roles store arrays of these keys; users can add grant/deny overrides.
 * Safe to import on the client (no secrets), used for UI gating and the role editor.
 */
export const PERMISSION_GROUPS = [
  {
    module: "dashboard",
    label: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View dashboard" }],
  },
  {
    module: "clients",
    label: "Clients",
    permissions: [
      { key: "clients.view", label: "View assigned clients" },
      { key: "clients.view_all", label: "View all clients" },
      { key: "clients.create", label: "Create clients" },
      { key: "clients.update", label: "Edit clients" },
      { key: "clients.archive", label: "Archive / restore clients" },
      { key: "clients.delete", label: "Delete clients" },
    ],
  },
  {
    module: "leads",
    label: "Leads",
    permissions: [
      { key: "leads.view", label: "View assigned leads" },
      { key: "leads.view_all", label: "View all leads" },
      { key: "leads.create", label: "Create leads" },
      { key: "leads.update", label: "Edit leads & log activities" },
      { key: "leads.assign", label: "Assign leads" },
      { key: "leads.convert", label: "Convert leads to clients" },
      { key: "leads.delete", label: "Delete / archive leads" },
      { key: "leads.export", label: "Export leads" },
    ],
  },
  {
    module: "finance",
    label: "Finance",
    permissions: [
      { key: "finance.view", label: "View financial dashboard" },
      { key: "invoices.view", label: "View invoices" },
      { key: "invoices.manage", label: "Create / edit / void invoices" },
      { key: "payments.view", label: "View payments" },
      { key: "payments.manage", label: "Record / reverse payments" },
      { key: "expenses.view", label: "View expenses" },
      { key: "expenses.manage", label: "Create / edit / delete expenses" },
    ],
  },
  {
    module: "tables",
    label: "Custom Tables",
    permissions: [
      { key: "tables.view", label: "Access custom tables" },
      { key: "tables.manage", label: "Create & configure tables (all tables)" },
    ],
  },
  {
    module: "projects",
    label: "Projects & Services",
    permissions: [
      { key: "projects.view", label: "View assigned projects" },
      { key: "projects.view_all", label: "View all projects" },
      { key: "projects.manage", label: "Create / edit projects" },
      { key: "services.view", label: "View services" },
      { key: "services.manage", label: "Manage services" },
    ],
  },
  {
    module: "team",
    label: "Employees & Tasks",
    permissions: [
      { key: "employees.view", label: "View employees" },
      { key: "tasks.view", label: "View own tasks" },
      { key: "tasks.view_all", label: "View all tasks" },
      { key: "tasks.manage", label: "Create / assign tasks" },
    ],
  },
  {
    module: "reports",
    label: "Reports & Logs",
    permissions: [
      { key: "reports.view", label: "View operational reports" },
      { key: "reports.finance", label: "View financial reports" },
      { key: "activity.view", label: "View activity logs" },
    ],
  },
  {
    module: "admin",
    label: "Administration",
    permissions: [
      { key: "users.view", label: "View users" },
      { key: "users.manage", label: "Create / edit users, reset passwords" },
      { key: "roles.manage", label: "Manage roles & permissions" },
      { key: "settings.manage", label: "Manage agency settings" },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key as Permission),
);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export const SUPER_ADMIN_SLUG = "super-admin";

const without = (...exclude: Permission[]) => ALL_PERMISSIONS.filter((p) => !exclude.includes(p));

/** Default system roles — seeded once; Admin/Manager/Employee remain editable. */
export const SYSTEM_ROLES: { slug: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    slug: SUPER_ADMIN_SLUG,
    name: "Super Admin",
    description: "Full, unrestricted access. Cannot be edited.",
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Runs the agency day-to-day. Cannot manage roles.",
    permissions: without("roles.manage"),
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Manages clients, leads, projects and the team. No finance administration.",
    permissions: [
      "dashboard.view",
      "clients.view", "clients.view_all", "clients.create", "clients.update", "clients.archive",
      "leads.view", "leads.view_all", "leads.create", "leads.update", "leads.assign", "leads.convert", "leads.export",
      "invoices.view", "payments.view",
      "tables.view",
      "projects.view", "projects.view_all", "projects.manage", "services.view",
      "employees.view", "tasks.view", "tasks.view_all", "tasks.manage",
      "reports.view",
      "users.view",
    ],
  },
  {
    slug: "employee",
    name: "Employee",
    description: "Works on assigned clients, leads, projects and tasks.",
    permissions: [
      "dashboard.view",
      "clients.view",
      "leads.view", "leads.create", "leads.update",
      "tables.view",
      "projects.view", "services.view",
      "tasks.view",
    ],
  },
];

/** Resolve effective permissions: role ∪ grants − denies. Super Admin always has everything. */
export function resolvePermissions(
  roleSlug: string,
  rolePermissions: string[],
  overrides?: { grant?: string[]; deny?: string[] },
): Permission[] {
  if (roleSlug === SUPER_ADMIN_SLUG) return [...ALL_PERMISSIONS];
  const set = new Set(rolePermissions.filter(isPermission));
  overrides?.grant?.filter(isPermission).forEach((p) => set.add(p));
  overrides?.deny?.forEach((p) => set.delete(p as Permission));
  return [...set];
}

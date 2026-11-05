import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SessionProvider } from "@/components/providers/session-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForcedPasswordChange } from "@/features/auth/components/forced-password-change";
import { can, requireUser } from "@/server/auth/dal";
import { listTables } from "@/features/tables/queries";
import { LeadStatusProvider } from "@/components/providers/lead-status-provider";
import { getLeadStatuses } from "@/server/services/lead-statuses";

// Every route here reads the session at request time.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) {
    return (
      <AuthShell>
        <ForcedPasswordChange email={user.email} />
      </AuthShell>
    );
  }

  const [tables, leadStatuses] = await Promise.all([
    can(user, "tables.view") ? listTables(user) : [],
    getLeadStatuses(),
  ]);

  return (
    <SessionProvider
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        roleName: user.roleName,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.permissions,
      }}
    >
      <LeadStatusProvider statuses={leadStatuses}>
      <SidebarProvider>
        <AppSidebar tables={tables.map((t) => ({ name: t.name, slug: t.slug, icon: t.icon }))} />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      </LeadStatusProvider>
    </SessionProvider>
  );
}

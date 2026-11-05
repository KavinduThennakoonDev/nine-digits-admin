import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SessionProvider } from "@/components/providers/session-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForcedPasswordChange } from "@/features/auth/components/forced-password-change";
import { requireUser } from "@/server/auth/dal";

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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}

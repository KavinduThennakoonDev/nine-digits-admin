"use client";

import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
};

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext value={user}>{children}</SessionContext>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside <SessionProvider>");
  return user;
}

/** UI-only gating. The server always re-checks permissions. */
export function useCan() {
  const user = useSession();
  return (...perms: Permission[]) => perms.every((p) => user.permissions.includes(p));
}

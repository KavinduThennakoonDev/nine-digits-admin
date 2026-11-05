"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LogoMark } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { UserMenu } from "./user-menu";
import { visibleNav } from "./nav-config";
import { TableIconView } from "@/features/tables/components/table-icon";
import type { TableIcon } from "@/lib/dynamic/types";

export type NavTable = { name: string; slug: string; icon: TableIcon };

export function AppSidebar({ tables = [] }: { tables?: NavTable[] }) {
  const user = useSession();
  const pathname = usePathname();
  const groups = visibleNav(user.permissions);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent active:bg-transparent">
              <Link href="/dashboard">
                <LogoMark size={32} />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">Nine Digits</span>
                  <span className="text-xs text-muted-foreground">Agency workspace</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // The longest matching nav href wins, so "/finance" isn't active on "/finance/invoices".
                  const best = groups.flatMap((g) => g.items).filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
                    .sort((a, b) => b.href.length - a.href.length)[0];
                  const active = best?.href === item.href && !(item.href === "/tables" && pathname.startsWith("/tables/") && !pathname.startsWith("/tables/new"));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {group.label === "Custom tables"
                  ? tables.slice(0, 8).map((t) => {
                      const href = `/tables/${t.slug}`;
                      const active = pathname === href || pathname.startsWith(`${href}/`);
                      return (
                        <SidebarMenuItem key={t.slug}>
                          <SidebarMenuButton asChild isActive={active} tooltip={t.name}>
                            <Link href={href}><TableIconView icon={t.icon} /><span>{t.name}</span></Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

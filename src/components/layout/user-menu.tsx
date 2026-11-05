"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useSession } from "@/components/providers/session-provider";
import { logoutAction } from "@/features/auth/actions";
import { UserAvatar } from "./user-avatar";

export function UserMenu() {
  const user = useSession();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <UserAvatar name={user.name} />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.roleName}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                <UserAvatar name={user.name} />
                <div className="grid text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <UserRound /> Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="dark:hidden" />
                  <Moon className="hidden dark:block" />
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light"><Sun /> Light</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark"><Moon /> Dark</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system"><Monitor /> System</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(e) => {
                e.preventDefault();
                startTransition(() => logoutAction());
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

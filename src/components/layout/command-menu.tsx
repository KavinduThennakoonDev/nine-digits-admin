"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Search, Sun, UserRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSession } from "@/components/providers/session-provider";
import { logoutAction } from "@/features/auth/actions";
import { visibleNav } from "./nav-config";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const user = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-8 w-full justify-start gap-2 text-muted-foreground sm:w-56 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left font-normal">Search…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command menu" description="Jump to a page or run a command">
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {visibleNav(user.permissions).map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.href} keywords={item.keywords} onSelect={() => run(() => router.push(item.href))}>
                  <item.icon /> {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem onSelect={() => run(() => router.push("/account"))}>
              <UserRound /> Account settings
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
            </CommandItem>
            <CommandItem onSelect={() => run(() => startTransition(() => logoutAction()))}>
              <LogOut /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

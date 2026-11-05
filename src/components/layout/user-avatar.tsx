import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-medium text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

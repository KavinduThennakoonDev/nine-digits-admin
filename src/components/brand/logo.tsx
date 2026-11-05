import Image from "next/image";
import { cn } from "@/lib/utils";

/** Monkey mark on a brand-orange tile — legible in light and dark themes. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-brand", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/brand/logo-mark.png" alt="" width={size} height={size} className="h-[72%] w-auto" priority />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">Nine Digits</span>
        <span className="text-[11px] text-muted-foreground">Admin</span>
      </span>
    </span>
  );
}

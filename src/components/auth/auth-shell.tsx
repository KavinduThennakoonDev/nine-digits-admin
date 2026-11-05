import Image from "next/image";
import { LogoMark } from "@/components/brand/logo";

/** Split-screen brand layout used by sign-in and the first-login password screen. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel colour matches the banner's own orange (#FF6600) so the art blends seamlessly. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#ff6600] lg:flex">
        <Image src="/brand/banner.png" alt="Nine Digits" width={1300} height={500} priority sizes="55vw" className="h-auto w-full" />
        <div className="space-y-2 p-12 text-black">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Clients, leads, finance and projects — in one place.</p>
          <p className="text-sm font-medium text-black/70">The Nine Digits agency workspace</p>
        </div>
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center gap-2.5 lg:hidden">
          <LogoMark size={36} />
          <span className="font-semibold tracking-tight">Nine Digits</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Nine Digits · Internal use only</p>
      </div>
    </div>
  );
}

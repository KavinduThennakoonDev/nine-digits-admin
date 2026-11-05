import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to the Nine Digits workspace.</p>
      </div>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <LoginForm />
    </div>
  );
}

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return null;
}

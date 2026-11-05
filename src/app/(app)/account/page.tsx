import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/server/auth/dal";
import { getProfile } from "@/features/users/queries";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Account" description={`Signed in as ${user.email} · ${user.roleName}`} />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to the rest of the team.</CardDescription>
        </CardHeader>
        <CardContent>{profile ? <ProfileForm profile={profile} /> : null}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password signs you out on every other device.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

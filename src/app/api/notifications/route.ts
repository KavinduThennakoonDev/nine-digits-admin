import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getNotificationSummary } from "@/features/notifications/queries";
import { maybeRunReminders } from "@/server/services/reminders";

/** Polled by the notification bell. Also keeps time-based reminders fresh between cron runs. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  after(() => maybeRunReminders().catch((e) => console.error("[reminders] sweep failed", e)));
  return NextResponse.json(await getNotificationSummary(user), { headers: { "Cache-Control": "no-store" } });
}

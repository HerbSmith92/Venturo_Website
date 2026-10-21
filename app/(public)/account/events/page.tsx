import { getCurrentUser } from "@/lib/auth";
import { isEventHost } from "@/lib/host-profile";
import { PORTAL_EVENTS, PORTAL_EVENTS_NEW } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const next = params.new === "1" ? PORTAL_EVENTS_NEW : PORTAL_EVENTS;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!(await isEventHost(user.id))) redirect("/account/host");
  if (params.new === "1") redirect(PORTAL_EVENTS_NEW);
  redirect(PORTAL_EVENTS);
}

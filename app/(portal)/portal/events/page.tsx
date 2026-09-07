import { getCurrentUser } from "@/lib/auth";
import { PORTAL_LOGIN } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function PortalEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(PORTAL_LOGIN);

  return (
    <main className="portal-welcome">
      <p className="eyebrow">Event Host</p>
      <h1>My Events</h1>
      <p className="lede muted">
        Current &amp; past events will live here. The menu grows as we add more.
      </p>
    </main>
  );
}

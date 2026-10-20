import { CompanionEvents } from "@/components/companion/CompanionEvents";
import { CompanionShell } from "@/components/companion/CompanionShell";
import { getCurrentUser } from "@/lib/auth";
import { COMPANION_LOGIN } from "@/lib/companion";
import { PORTAL_EVENTS } from "@/lib/portal";
import { listCompanionDoorEvents, type CompanionEventCard } from "@/lib/companion-data";
import { redirect } from "next/navigation";

export default async function CompanionHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect(COMPANION_LOGIN);

  let events: CompanionEventCard[] = [];
  try {
    events = await listCompanionDoorEvents(user.id);
  } catch {
    events = [];
  }

  return (
    <CompanionShell signedIn title="Pick An Event" menuHref={PORTAL_EVENTS} menuLabel="Event Host">
      <CompanionEvents initialEvents={events} />
    </CompanionShell>
  );
}

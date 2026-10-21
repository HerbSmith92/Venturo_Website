import { AccountFrame } from "@/components/AccountFrame";
import { getCurrentUser } from "@/lib/auth";
import { listAccessibleEvents } from "@/lib/events";
import { isEventHost } from "@/lib/host-profile";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const host = user ? await isEventHost(user.id) : false;
  const events = user && host ? await listAccessibleEvents(user.id) : [];
  return (
    <AccountFrame
      host={host}
      events={events.map((event) => ({ id: event.id, title: event.title }))}
    >
      {children}
    </AccountFrame>
  );
}

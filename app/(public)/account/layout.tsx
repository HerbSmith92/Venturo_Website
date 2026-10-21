import { AccountFrame } from "@/components/AccountFrame";
import { getCurrentUser } from "@/lib/auth";
import { listClaimedCommunities } from "@/lib/communities";
import { listAccessibleEvents } from "@/lib/events";
import { isEventHost } from "@/lib/host-profile";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const host = user ? await isEventHost(user.id) : false;
  const [events, communities] = await Promise.all([
    user && host ? listAccessibleEvents(user.id) : Promise.resolve([]),
    user ? listClaimedCommunities(user.id) : Promise.resolve([]),
  ]);
  return (
    <AccountFrame
      host={host}
      events={events.map((event) => ({ id: event.id, title: event.title }))}
      communities={communities.map((community) => ({ id: community.id, title: community.title }))}
    >
      {children}
    </AccountFrame>
  );
}

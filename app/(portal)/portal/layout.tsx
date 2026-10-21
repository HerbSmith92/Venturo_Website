import { AccountFrame } from "@/components/AccountFrame";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PortalChrome } from "@/components/portal/PortalChrome";
import { getCurrentUser } from "@/lib/auth";
import { listClaimedCommunities } from "@/lib/communities";
import { listAccessibleEvents } from "@/lib/events";
import { isEventHost } from "@/lib/host-profile";

export default async function PortalSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="portal-shell">
        <PortalChrome signedIn={false} />
        <div className="portal-main">{children}</div>
      </div>
    );
  }

  const [host, events, communities] = await Promise.all([
    isEventHost(user.id),
    listAccessibleEvents(user.id),
    listClaimedCommunities(user.id),
  ]);

  return (
    <>
      <SiteHeader user={user} />
      <AccountFrame
        host={host || events.length > 0}
        events={events.map((event) => ({ id: event.id, title: event.title }))}
        communities={communities.map((community) => ({ id: community.id, title: community.title }))}
      >
        {children}
      </AccountFrame>
      <SiteFooter />
    </>
  );
}
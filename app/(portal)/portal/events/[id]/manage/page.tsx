import { EventStudio } from "@/components/events/EventStudio";
import { EventChrome } from "@/components/portal/EventChrome";
import { ManageEventTools } from "@/components/portal/ManageEventTools";
import { getEventCommunity, listClaimedCommunities } from "@/lib/communities";
import { requirePortalEvent } from "@/lib/event-access";
import { getPlatformFees } from "@/lib/events";
import { listEventCollaborators } from "@/lib/event-collaborators";
import { createClient } from "@/lib/supabase/server";

export default async function PortalManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event, user, canEdit, access } = await requirePortalEvent(id, "editor");
  const [fees, collaborators, linkedCommunity, claimed] = await Promise.all([
    getPlatformFees(),
    listEventCollaborators(id),
    getEventCommunity(id),
    listClaimedCommunities(user.id),
  ]);
  const supabase = await createClient();
  let hasPayout = false;
  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", event.organiserId)
      .maybeSingle();
    hasPayout = Boolean(data);
  }
  const communityOptions = [
    ...(linkedCommunity
      ? [
          {
            id: linkedCommunity.id,
            title: linkedCommunity.title,
            slug: linkedCommunity.slug,
            coverUrl: linkedCommunity.coverUrl,
            audience: linkedCommunity.audience,
            status: linkedCommunity.status,
          },
        ]
      : []),
    ...claimed
      .filter((item) => item.id !== linkedCommunity?.id)
      .map((item) => ({
        id: item.id,
        title: item.title || "Untitled community",
        slug: item.slug,
        coverUrl: item.coverUrl,
        audience: item.audience,
        status: item.status,
      })),
  ];

  return (
    <main className="portal-studio">
      <EventChrome event={event} current="manage">
        <ManageEventTools
          event={event}
          canEdit={canEdit}
          isOwner={access === "owner" || access === "staff"}
          collaborators={collaborators}
          actorEmail={user.email ?? ""}
        />
        <EventStudio
          event={event}
          isStaff={access === "staff"}
          hasPayout={hasPayout}
          fees={fees}
          stay="portal"
          focus="manage"
          linkedCommunity={linkedCommunity}
          communityOptions={communityOptions}
        />
      </EventChrome>
    </main>
  );
}

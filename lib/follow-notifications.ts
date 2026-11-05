import { notifyMemberUsers } from "@/lib/push-notifications";
import { createServiceClient } from "@/lib/supabase/admin";

/** A published guide reaches people who follow that author. */
export async function notifyAuthorFollowers(guideId: string) {
  const service = createServiceClient();
  if (!service || !guideId) return;

  const { data: guide } = await service
    .from("curated_guides")
    .select("id, title, slug, author_id, status")
    .eq("id", guideId)
    .maybeSingle();
  if (!guide || guide.status !== "published" || !guide.author_id || !guide.slug) return;

  const { data: author } = await service
    .from("guide_authors")
    .select("display_name")
    .eq("id", guide.author_id)
    .maybeSingle();
  const { data: follows } = await service
    .from("author_follows")
    .select("user_id")
    .eq("author_id", guide.author_id);

  const name = String(author?.display_name ?? "An author").trim() || "An author";
  const title = String(guide.title ?? "A new guide").trim() || "A new guide";
  await notifyMemberUsers({
    userIds: (follows ?? []).map((row) => String(row.user_id)),
    title: name,
    body: `${title} is live.`,
    linkPath: `/guides/${guide.slug}`,
    kind: "guide",
    id: guide.id,
    slug: guide.slug,
    notice: "custom",
  });
}

/** A public event on a followed community reaches that community's followers. */
export async function notifyCommunityFollowers(communityId: string, eventId: string) {
  const service = createServiceClient();
  if (!service || !communityId || !eventId) return;

  const { data: event } = await service
    .from("events")
    .select("id, title, slug, status, visibility")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.status !== "approved" || event.visibility === "private" || !event.slug) return;

  const { data: link } = await service
    .from("community_events")
    .select("link_status")
    .eq("community_id", communityId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (link?.link_status !== "approved") return;

  const { data: community } = await service
    .from("communities")
    .select("title")
    .eq("id", communityId)
    .maybeSingle();
  const { data: follows } = await service
    .from("community_follows")
    .select("user_id")
    .eq("community_id", communityId);

  const name = String(community?.title ?? "A community").trim() || "A community";
  const eventTitle = String(event.title ?? "A new event").trim() || "A new event";
  await notifyMemberUsers({
    userIds: (follows ?? []).map((row) => String(row.user_id)),
    title: name,
    body: `${eventTitle} is live.`,
    linkPath: `/events/${event.slug}`,
    kind: "event",
    id: event.id,
    slug: event.slug,
    notice: "community",
  });
}

/** After an event is approved, tell followers of every community already linked to it. */
export async function notifyApprovedEventCommunities(eventId: string) {
  const service = createServiceClient();
  if (!service || !eventId) return;
  const { data: links } = await service
    .from("community_events")
    .select("community_id")
    .eq("event_id", eventId)
    .eq("link_status", "approved");
  for (const link of links ?? []) {
    await notifyCommunityFollowers(String(link.community_id), eventId);
  }
}

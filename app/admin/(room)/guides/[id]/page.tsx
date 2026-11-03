import { notFound } from "next/navigation";
import { GuideEditor } from "@/components/admin/GuideEditor";
import { getStaffSession } from "@/lib/auth";
import { loadGuideEditor, loadGuidePlaces, loadSpotlightListingDetails } from "@/lib/control-room-guides";
import { loadGuideAuthors, linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { loadEditorCatalog } from "@/lib/control-room";
import { listAdminEvents } from "@/lib/events";
import { mapEventSource } from "@/lib/guide-carousel";
import { listGuideEventIds } from "@/lib/guides";
import { canManageGuide, guideViewerFor } from "@/lib/guide-access";
import { isAdmin, isStaff } from "@/lib/roles";

export default async function GuideEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const session = await getStaffSession();
  const guide = await loadGuideEditor(id);
  if (!guide) notFound();
  const admin = isAdmin(session?.role);
  const linkedAuthor = session?.id ? await linkedAuthorIdForUser(session.id) : null;
  if (!canManageGuide(guide, guideViewerFor(session ? { ...session, linkedAuthorId: linkedAuthor } : null))) {
    notFound();
  }

  const linkedListing = guide.listing_id ? await loadSpotlightListingDetails(guide.listing_id) : null;
  const [catalog, events, linkedIds, places, authors] = await Promise.all([
    loadEditorCatalog(),
    listAdminEvents("approved"),
    listGuideEventIds(id),
    loadGuidePlaces(),
    loadGuideAuthors(),
  ]);
  const linked = new Set(linkedIds);
  const notice =
    done === "duplicated"
      ? "Duplicated as a new draft. Change the dates & publish when you are ready."
      : done === "publish"
        ? "Guide published."
        : done === "unpublish"
          ? "Guide unpublished."
          : done === "archive"
            ? "Guide archived."
            : done === "links"
              ? "Event links saved."
              : done === "submit"
                ? "Submitted for review."
                : done === "request_changes"
                  ? "Changes requested."
              : undefined;

  return (
    <GuideEditor
      guide={guide}
      catalog={catalog}
      notice={notice}
      error={error}
      events={events.map((event) => ({ id: event.id, title: event.title }))}
      carouselEvents={events.filter((event) => linked.has(event.id)).map(mapEventSource)}
      linkedEventIds={[...linked]}
      places={places}
      authors={authors}
      canPublish={admin}
      lockAuthor={!isStaff(session?.role) && Boolean(linkedAuthor)}
      listing={linkedListing}
    />
  );
}

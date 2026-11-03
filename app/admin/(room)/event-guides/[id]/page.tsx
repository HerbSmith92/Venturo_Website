import { notFound } from "next/navigation";
import { EventGuideEditor } from "@/components/admin/EventGuideEditor";
import { getStaffSession } from "@/lib/auth";
import { loadEventGuideEditor, loadGuidePlaces } from "@/lib/control-room-event-guides";
import { loadGuideAuthors, linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { canManageGuide, guideViewerFor } from "@/lib/guide-access";
import { isAdmin, isStaff } from "@/lib/roles";

export default async function EventGuideEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const session = await getStaffSession();
  const guide = await loadEventGuideEditor(id);
  if (!guide) notFound();
  const admin = isAdmin(session?.role);
  const linkedAuthor = session?.id ? await linkedAuthorIdForUser(session.id) : null;
  if (!canManageGuide(guide, guideViewerFor(session ? { ...session, linkedAuthorId: linkedAuthor } : null))) {
    notFound();
  }
  const [places, authors] = await Promise.all([
    loadGuidePlaces(),
    loadGuideAuthors(),
  ]);
  const notice =
    done === "duplicated"
      ? "Duplicated as a new draft. Change the dates & publish when you are ready."
      : done === "publish"
        ? "Event guide published."
        : done === "unpublish"
          ? "Event guide unpublished."
          : done === "archive"
            ? "Event guide archived."
            : undefined;

  return (
    <EventGuideEditor
      guide={guide}
      notice={notice}
      error={error}
      places={places}
      authors={authors}
      canPublish={admin}
      lockAuthor={!isStaff(session?.role) && Boolean(linkedAuthor)}
    />
  );
}

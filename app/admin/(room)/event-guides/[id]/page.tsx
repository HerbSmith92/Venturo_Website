import { notFound } from "next/navigation";
import { EventGuideEditor } from "@/components/admin/EventGuideEditor";
import { getStaffSession } from "@/lib/auth";
import { loadEventGuideEditor, loadGuidePlaces } from "@/lib/control-room-event-guides";
import { loadGuideAuthors, linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { isAdmin } from "@/lib/roles";

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
  if (session && !admin && guide.created_by !== session.id && guide.status !== "published") {
    notFound();
  }
  const [places, authors, linkedAuthor] = await Promise.all([
    loadGuidePlaces(),
    loadGuideAuthors(),
    session?.id ? linkedAuthorIdForUser(session.id) : Promise.resolve(null),
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
      lockAuthor={!admin && Boolean(linkedAuthor)}
    />
  );
}

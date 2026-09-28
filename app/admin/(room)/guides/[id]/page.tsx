import { notFound } from "next/navigation";
import { saveGuideEvents } from "@/app/admin/content-actions";
import { GuideEditor } from "@/components/admin/GuideEditor";
import { loadGuideEditor } from "@/lib/control-room-guides";
import { loadEditorCatalog } from "@/lib/control-room";
import { listAdminEvents } from "@/lib/events";
import { listGuideEventIds } from "@/lib/guides";

export default async function GuideEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const guide = await loadGuideEditor(id);
  if (!guide) notFound();

  const [catalog, events, linkedIds] = await Promise.all([
    loadEditorCatalog(),
    listAdminEvents("approved"),
    listGuideEventIds(id),
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
            : undefined;

  return (
    <>
      <GuideEditor guide={guide} catalog={catalog} notice={notice} error={error} />
      <form action={saveGuideEvents} className="cr-panel" style={{ marginTop: 28 }}>
        <h2>Linked Events</h2>
        <p className="muted">
          Activities stay in the guide above. Tick the events this guide should open in the app.
        </p>
        <input type="hidden" name="guide_id" value={guide.id} />
        {events.length === 0 ? <p className="muted">No live events yet.</p> : null}
        {events.map((event) => (
          <label key={event.id} className="field">
            <span>
              <input
                type="checkbox"
                name="event_ids"
                value={event.id}
                defaultChecked={linked.has(event.id)}
              />{" "}
              {event.title}
            </span>
          </label>
        ))}
        <button className="btn btn-secondary" type="submit">
          Save Event Links
        </button>
      </form>
    </>
  );
}

import { notFound } from "next/navigation";
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
            : done === "links"
              ? "Event links saved."
              : undefined;

  return (
    <GuideEditor
      guide={guide}
      catalog={catalog}
      notice={notice}
      error={error}
      events={events.map((event) => ({ id: event.id, title: event.title }))}
      linkedEventIds={[...linked]}
    />
  );
}

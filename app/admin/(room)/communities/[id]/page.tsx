import { notFound } from "next/navigation";
import { CommunityEditor } from "@/components/admin/CommunityEditor";
import {
  getCommunityById,
  listCommunityEventLinks,
  listCommunityKindIds,
  listCommunityPersonaIds,
  listCommunityPhotos,
} from "@/lib/communities";
import { loadEditorCatalog } from "@/lib/control-room";

export default async function AdminCommunityEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const community = await getCommunityById(id);
  if (!community) notFound();

  const [catalog, photos, kindIds, personaIds, events] = await Promise.all([
    loadEditorCatalog(),
    listCommunityPhotos(id),
    listCommunityKindIds(id),
    listCommunityPersonaIds(id),
    listCommunityEventLinks(id),
  ]);

  return (
    <CommunityEditor
      community={community}
      catalog={catalog}
      photos={photos}
      kindIds={kindIds}
      personaIds={personaIds}
      events={events}
      notice={done ? "Saved." : undefined}
      error={error}
    />
  );
}

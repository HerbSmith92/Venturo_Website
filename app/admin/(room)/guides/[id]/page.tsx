import { notFound } from "next/navigation";
import { GuideEditor } from "@/components/admin/GuideEditor";
import { loadGuideEditor } from "@/lib/control-room-guides";
import { loadEditorCatalog } from "@/lib/control-room";

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

  const catalog = await loadEditorCatalog();
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
    <GuideEditor guide={guide} catalog={catalog} notice={notice} error={error} />
  );
}

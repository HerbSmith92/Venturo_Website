import { notFound, redirect } from "next/navigation";
import { AuthorEditor } from "@/components/admin/AuthorEditor";
import { getStaffSession } from "@/lib/auth";
import {
  loadGuideAuthor,
  loadGuideStaffOptions,
  loadLatestPublishedGuideForAuthor,
} from "@/lib/control-room-authors";
import { isAdmin } from "@/lib/roles";

export default async function AuthorEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login?next=/admin/guides");
  const { id } = await params;
  const { error } = await searchParams;
  const author = await loadGuideAuthor(id);
  if (!author) notFound();
  const admin = isAdmin(session.role);
  if (!admin && author.user_id !== session.id) redirect("/admin/denied");
  const [staff, latestGuide] = await Promise.all([
    admin ? loadGuideStaffOptions() : Promise.resolve([]),
    loadLatestPublishedGuideForAuthor(id),
  ]);
  return (
    <AuthorEditor
      author={author}
      staff={staff}
      latestGuide={latestGuide}
      error={error}
      canLinkStaff={admin}
    />
  );
}

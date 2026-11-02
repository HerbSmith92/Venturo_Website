import { AuthorsDashboard } from "@/components/admin/AuthorsDashboard";
import { requireAdmin } from "@/lib/auth";
import { loadGuideAuthorsDashboard } from "@/lib/control-room-authors";

export default async function AuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const { authors, invites } = await loadGuideAuthorsDashboard();

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <AuthorsDashboard authors={authors} invites={invites} />
    </>
  );
}

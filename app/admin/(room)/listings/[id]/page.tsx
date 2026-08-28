import { notFound } from "next/navigation";
import { ListingEditor } from "@/components/admin/ListingEditor";
import {
  loadAudit,
  loadEditorBranches,
  loadEditorCatalog,
  loadListing,
} from "@/lib/control-room";

export default async function ListingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const listing = await loadListing(id);
  if (!listing) notFound();

  const [audit, catalog, branches] = await Promise.all([
    loadAudit(id),
    loadEditorCatalog(),
    loadEditorBranches(listing.business_id),
  ]);

  const notice =
    done === "edit"
      ? "Draft saved."
      : done
        ? `Saved: ${done}.`
        : undefined;

  return (
    <ListingEditor
      listing={listing}
      catalog={catalog}
      branches={branches}
      audit={audit}
      notice={notice}
      error={error}
    />
  );
}

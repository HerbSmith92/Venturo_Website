import { notFound } from "next/navigation";
import { ListingEditor } from "@/components/admin/ListingEditor";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  loadAudit,
  loadEditorBranches,
  loadEditorCatalog,
  loadListing,
} from "@/lib/control-room";
import { listingQueueFromSearch, loadListingSteps } from "@/lib/listing-queue";

export default async function ListingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    done?: string;
    status?: string;
    q?: string;
    interest?: string;
    author?: string;
    sort?: string;
    dir?: string;
    group?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { error, done } = query;
  const session = await getStaffSession();
  const listing = await loadListing(id);
  if (!listing) notFound();

  const queue = listingQueueFromSearch({
    ...query,
    status: query.status || listing.status,
  });
  const [audit, catalog, branches, steps] = await Promise.all([
    loadAudit(id),
    loadEditorCatalog(),
    loadEditorBranches(listing.business_id),
    loadListingSteps(id, queue),
  ]);

  const notice =
    done === "edit"
      ? listing.status === "approved"
        ? "Edits saved. The live listing stays as it is until an admin approves."
        : "Draft saved."
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
      canApprove={isAdmin(session?.role)}
      steps={steps}
    />
  );
}

import { applyListingAction } from "@/app/admin/actions";
import type { ListingDetail } from "@/lib/control-room-types";

export function ListingActions({ listing }: { listing: ListingDetail }) {
  return (
    <>
      {listing.status !== "approved" && (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="approve" />
          <button className="btn btn-primary" type="submit">
            Approve & Publish
          </button>
        </form>
      )}
      {listing.status !== "review" && listing.status !== "approved" && (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="review" />
          <button className="btn btn-secondary" type="submit">
            Move To Review
          </button>
        </form>
      )}
      {listing.status !== "draft" && (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="draft" />
          <button className="btn btn-secondary" type="submit">
            Request Changes
          </button>
        </form>
      )}
      {listing.status !== "archived" && (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="archive" />
          <button className="btn btn-secondary" type="submit">
            Reject & Archive
          </button>
        </form>
      )}
      <form action={applyListingAction}>
        <input type="hidden" name="id" value={listing.id} />
        <input type="hidden" name="action" value="feature" />
        <input type="hidden" name="featured" value={listing.is_featured ? "false" : "true"} />
        <button className="btn btn-secondary" type="submit">
          {listing.is_featured ? "Remove Top Pick" : "Feature As Top Pick"}
        </button>
      </form>
    </>
  );
}

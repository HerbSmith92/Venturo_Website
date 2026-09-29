import { applyListingAction, deleteArchivedListing } from "@/app/admin/actions";
import type { ListingDetail } from "@/lib/control-room-types";
import { DeleteArchivedListing } from "@/components/admin/DeleteArchivedListing";

export function ListingActions({ listing }: { listing: ListingDetail }) {
  const suspended = Boolean(listing.is_suspended);
  const archived = listing.status === "archived";
  const scheduled =
    listing.status === "approved" &&
    Boolean(listing.publish_at) &&
    new Date(listing.publish_at ?? "").getTime() > Date.now();

  return (
    <>
      {listing.review_note ? (
        <p className="notice">Last note: {listing.review_note}</p>
      ) : null}
      {suspended ? (
        <p className="notice">
          This business asked us to take the listing down. It stays here until you recover it.
        </p>
      ) : null}
      {listing.status !== "approved" || suspended || scheduled ? (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="approve" />
          <button className="btn btn-primary" type="submit">
            Approve & Publish
          </button>
        </form>
      ) : null}
      {listing.status !== "review" && listing.status !== "approved" && (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="review" />
          <button className="btn btn-secondary" type="submit">
            Send For Approval
          </button>
        </form>
      )}
      {listing.status !== "draft" && (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="draft" />
          <label className="field">
            <span>Reason for changes</span>
            <textarea name="note" required rows={2} placeholder="What should change before this can go live?" />
          </label>
          <button className="btn btn-secondary" type="submit">
            Request Changes
          </button>
        </form>
      )}
      {listing.status === "approved" && !suspended ? (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="suspend" />
          <label className="field">
            <span>They asked us to take this down</span>
            <textarea name="note" rows={2} placeholder="Optional note" />
          </label>
          <button className="btn btn-secondary" type="submit">
            Suspend
          </button>
        </form>
      ) : null}
      {suspended ? (
        <form action={applyListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="unsuspend" />
          <button className="btn btn-primary" type="submit">
            Recover
          </button>
        </form>
      ) : null}
      {archived ? (
        <DeleteArchivedListing id={listing.id} action={deleteArchivedListing} />
      ) : (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="archive" />
          <label className="field">
            <span>Archive note (optional)</span>
            <textarea name="note" rows={2} placeholder="Why this listing is leaving the directory." />
          </label>
          <button className="btn btn-secondary" type="submit">
            Archive
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

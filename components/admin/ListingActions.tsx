import { applyListingAction } from "@/app/admin/actions";
import type { ListingDetail } from "@/lib/control-room-types";

export function ListingActions({ listing }: { listing: ListingDetail }) {
  const suspended = Boolean(listing.is_suspended);
  const scheduled =
    listing.status === "approved" &&
    Boolean(listing.publish_at) &&
    new Date(listing.publish_at ?? "").getTime() > Date.now();

  return (
    <>
      {listing.review_note ? (
        <p className="notice">Last note: {listing.review_note}</p>
      ) : null}
      {scheduled ? (
        <p className="notice">
          Scheduled for {new Date(listing.publish_at ?? "").toLocaleString("en-ZA", { hourCycle: "h23" })}.
          The website and app stay quiet until then.
        </p>
      ) : null}
      {listing.status !== "approved" || suspended || scheduled ? (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="approve" />
          <label className="field">
            <span>Go live at (optional, Johannesburg time)</span>
            <input name="publish_at" type="datetime-local" />
          </label>
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
            Move To Review
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
            <span>Why it is leaving the app</span>
            <textarea name="note" rows={2} placeholder="Optional" />
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
            Return To The App
          </button>
        </form>
      ) : null}
      {listing.status !== "archived" && (
        <form action={applyListingAction} className="cr-action-note">
          <input type="hidden" name="id" value={listing.id} />
          <input type="hidden" name="action" value="archive" />
          <label className="field">
            <span>Reason for rejection</span>
            <textarea name="note" required rows={2} placeholder="Why this listing cannot go live." />
          </label>
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

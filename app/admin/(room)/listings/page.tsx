import { DeleteArchivedListing } from "@/components/admin/DeleteArchivedListing";
import { BulkForm } from "@/components/admin/BulkForm";
import { DirectoryColumnHead } from "@/components/admin/DirectoryColumnHead";
import { bulkListingAction } from "@/app/admin/bulk-actions";
import { deleteArchivedListing } from "@/app/admin/actions";
import { getStaffSession } from "@/lib/auth";
import { formatClock, listingStatusLabel, loadDirectoryQueue } from "@/lib/control-room";
import type { QueueListing } from "@/lib/control-room-types";
import { directoryGroups, listingEditorHref, listingQueueFromSearch, type ListingQueue } from "@/lib/listing-queue";
import { isAdmin } from "@/lib/roles";

export default async function ListingsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    interest?: string;
    author?: string;
    sort?: string;
    dir?: string;
    group?: string;
    error?: string;
  }>;
}) {
  const { status = "approved", q = "", interest = "", author = "", sort = "", dir = "", group = "", error } =
    await searchParams;
  const session = await getStaffSession();
  const canBulk = isAdmin(session?.role);
  const board = await loadDirectoryQueue({ status, q, interest, author, sort, dir });
  const queue = listingQueueFromSearch({ status, q, interest, author, sort, dir, group });
  const grouped = group === "interest" ? directoryGroups(board.rows) : null;
  const canDelete = status === "archived";
  const columns = canBulk ? 7 : 6;
  const query = new URLSearchParams({ status });
  if (q) query.set("q", q);
  if (interest) query.set("interest", interest);
  if (author) query.set("author", author);
  if (sort) query.set("sort", sort);
  if (dir) query.set("dir", dir);
  if (group) query.set("group", group);
  const returnTo = `/admin/listings?${query.toString()}`;

  const table = (
    <div className="cr-table-wrap">
      <table className="cr-table cr-directory-table">
        <DirectoryColumnHead
          status={status}
          interest={interest}
          author={author}
          query={q}
          sort={sort}
          dir={dir}
          group={group}
          interests={board.interests}
          authors={board.authors}
          selectable={canBulk}
        />
        <tbody>
          {board.rows.length === 0 ? (
            <tr>
              <td colSpan={columns} className="muted">
                Nothing in this queue.
              </td>
            </tr>
          ) : grouped ? (
            grouped.map((bucket) => (
              <ListingGroup key={bucket.title} title={bucket.title} rows={bucket.rows} canDelete={canDelete} columns={columns} selectable={canBulk} queue={queue} />
            ))
          ) : (
            board.rows.map((listing) => (
              <ListingRow key={listing.id} listing={listing} canDelete={canDelete} selectable={canBulk} queue={queue} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="cr-directory">
      <div className="cr-directory-head">
        <h1>Directory</h1>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {canBulk && board.rows.length > 0 ? (
        <BulkForm formId="bulk-listings" noun="Activity" nouns="Activities" action={bulkListingAction} returnTo={returnTo}>
          {table}
        </BulkForm>
      ) : (
        table
      )}
    </section>
  );
}

function ListingGroup({
  title,
  rows,
  canDelete,
  columns,
  selectable,
  queue,
}: {
  title: string;
  rows: QueueListing[];
  canDelete: boolean;
  columns: number;
  selectable: boolean;
  queue: ListingQueue;
}) {
  return (
    <>
      <tr className="cr-directory-group">
        <td colSpan={columns}>{title}</td>
      </tr>
      {rows.map((listing) => (
        <ListingRow key={listing.id} listing={listing} canDelete={canDelete} selectable={selectable} queue={queue} />
      ))}
    </>
  );
}

function ListingRow({
  listing,
  canDelete,
  selectable,
  queue,
}: {
  listing: QueueListing;
  canDelete: boolean;
  selectable: boolean;
  queue: ListingQueue;
}) {
  const place = [listing.branch_name, listing.suburb, listing.city].filter(Boolean).join(" · ");
  const scheduled = Boolean(listing.publish_at) && new Date(listing.publish_at ?? "").getTime() > Date.now();
  return (
    <tr>
      {selectable ? (
        <td className="cr-bulk-cell">
          <input className="cr-bulk-check" type="checkbox" name="id" value={listing.id} form="bulk-listings" aria-label={`Select ${listing.name}`} />
        </td>
      ) : null}
      <td>
        <div className="cr-directory-listing">
          {listing.cover_url ? (
            <span className="cr-directory-photo">
              <img src={listing.cover_url} alt="" />
            </span>
          ) : (
            <span className="cr-directory-thumb" aria-hidden="true" />
          )}
          <div>
            <strong>{listing.name}</strong>
            {listing.is_featured ? <span className="cr-directory-pick">Top Pick</span> : null}
            {place ? <p>{place}</p> : null}
          </div>
        </div>
      </td>
      <td>
        <span className={`cr-pill status-${listing.is_suspended ? "suspended" : listing.status}`}>
          {listingStatusLabel(listing.status, {
            suspended: Boolean(listing.is_suspended),
            scheduled,
          })}
        </span>
        {listing.status === "draft" && listing.review_note ? (
          <p className="cr-directory-note">{listing.review_note}</p>
        ) : null}
      </td>
      <td>{listing.interest || "—"}</td>
      <td>{listing.author || "—"}</td>
      <td>{formatClock(listing.updated_at)}</td>
      <td>
        <div className="cr-directory-actions">
          <a className="btn btn-primary" href={listingEditorHref(listing.id, queue)}>
            Edit
          </a>
          {canDelete ? <DeleteArchivedListing id={listing.id} action={deleteArchivedListing} /> : null}
        </div>
      </td>
    </tr>
  );
}

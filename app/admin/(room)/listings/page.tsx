import { DeleteArchivedListing } from "@/components/admin/DeleteArchivedListing";
import { DirectoryColumnHead } from "@/components/admin/DirectoryColumnHead";
import { deleteArchivedListing } from "@/app/admin/actions";
import { formatClock, listingStatusLabel, loadDirectoryQueue } from "@/lib/control-room";
import type { QueueListing } from "@/lib/control-room-types";

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
  const board = await loadDirectoryQueue({ status, q, interest, author, sort, dir });
  const grouped = group === "interest" ? groupRows(board.rows) : null;
  const canDelete = status === "archived";

  return (
    <section className="cr-directory">
      <div className="cr-directory-head">
        <h1>Directory</h1>
      </div>
      {error ? <p className="error">{error}</p> : null}
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
          />
          <tbody>
            {board.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing in this queue.
                </td>
              </tr>
            ) : grouped ? (
              grouped.map((bucket) => (
                <ListingGroup key={bucket.title} title={bucket.title} rows={bucket.rows} canDelete={canDelete} />
              ))
            ) : (
              board.rows.map((listing) => <ListingRow key={listing.id} listing={listing} canDelete={canDelete} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupRows(rows: QueueListing[]) {
  const buckets = new Map<string, QueueListing[]>();
  for (const row of rows) {
    const title = row.interest?.trim() || "Other";
    const list = buckets.get(title) ?? [];
    list.push(row);
    buckets.set(title, list);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => {
      if (left === "Other") return 1;
      if (right === "Other") return -1;
      return left.localeCompare(right, "en", { sensitivity: "base" });
    })
    .map(([title, items]) => ({ title, rows: items }));
}

function ListingGroup({ title, rows, canDelete }: { title: string; rows: QueueListing[]; canDelete: boolean }) {
  return (
    <>
      <tr className="cr-directory-group">
        <td colSpan={6}>{title}</td>
      </tr>
      {rows.map((listing) => (
        <ListingRow key={listing.id} listing={listing} canDelete={canDelete} />
      ))}
    </>
  );
}

function ListingRow({ listing, canDelete }: { listing: QueueListing; canDelete: boolean }) {
  const place = [listing.branch_name, listing.suburb, listing.city].filter(Boolean).join(" · ");
  const scheduled = Boolean(listing.publish_at) && new Date(listing.publish_at ?? "").getTime() > Date.now();
  return (
    <tr>
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
          <a className="btn btn-primary" href={`/admin/listings/${listing.id}`}>
            Edit
          </a>
          {canDelete ? <DeleteArchivedListing id={listing.id} action={deleteArchivedListing} /> : null}
        </div>
      </td>
    </tr>
  );
}

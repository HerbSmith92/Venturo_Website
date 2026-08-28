import {
  formatClock,
  formatRand,
  listingStatusLabel,
  loadQueue,
  type ListingStatus,
} from "@/lib/control-room";

const TABS: { id: "" | ListingStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "review", label: "In Review" },
  { id: "draft", label: "Draft" },
  { id: "approved", label: "Live" },
  { id: "archived", label: "Archived" },
];

export default async function ListingsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string }>;
}) {
  const { status = "", q = "", error } = await searchParams;
  const listings = await loadQueue(status, q);

  return (
    <section>
      <p className="eyebrow">Directory Queue</p>
      <h1>Listings</h1>
      <p className="lede muted">
        Edit, approve & publish, request changes, or archive. Admin override
        always wins.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="cr-filters" action="/admin/listings">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name"
          aria-label="Search listings"
        />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      <div className="cr-tabs">
        {TABS.map((tab) => {
          const href = tab.id ? `/admin/listings?status=${tab.id}` : "/admin/listings";
          const active = status === tab.id;
          return (
            <a key={tab.label} className={active ? "cr-tab active" : "cr-tab"} href={href}>
              {tab.label}
            </a>
          );
        })}
      </div>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Place</th>
              <th>Status</th>
              <th>From</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nothing in this queue.
                </td>
              </tr>
            )}
            {listings.map((listing) => (
              <tr key={listing.id}>
                <td>
                  <a href={`/admin/listings/${listing.id}`}>
                    {listing.name}
                    {listing.is_featured ? " · Top Pick" : ""}
                  </a>
                  {listing.branch_name && <div className="muted">{listing.branch_name}</div>}
                </td>
                <td>
                  {[listing.suburb, listing.city].filter(Boolean).join(", ") || "—"}
                </td>
                <td>
                  <span className={`cr-pill status-${listing.status}`}>
                    {listingStatusLabel(listing.status)}
                  </span>
                </td>
                <td>{formatRand(listing.price_from)}</td>
                <td>{formatClock(listing.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { reviewClaim } from "@/app/admin/content-actions";
import { formatClock } from "@/lib/control-room-shared";
import { createClient } from "@/lib/supabase/server";

type ClaimRow = {
  id: string;
  listing_name: string;
  listing_slug: string | null;
  evidence: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("listing_claims")
        .select("id, listing_name, listing_slug, evidence, status, review_note, created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const rows = (data ?? []) as ClaimRow[];
  const pending = rows.filter((row) => row.status === "pending");

  return (
    <section>
      <p className="eyebrow">Operations</p>
      <h1>Claims</h1>
      <p className="lede muted">
        A claim does not publish the listing. Approve the evidence, then use Directory to put it live.
      </p>
      {done ? <p className="notice">Claim updated.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <p className="muted">{pending.length} waiting.</p>
      <div className="cr-stack">
        {rows.length === 0 ? <p className="muted">No claims yet.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="cr-panel">
            <p className="eyebrow">{row.status}</p>
            <h2>{row.listing_name}</h2>
            {row.listing_slug ? (
              <p>
                <a href={`/directory/${row.listing_slug}`}>Open the public listing</a>
              </p>
            ) : null}
            <p>{row.evidence}</p>
            {row.review_note ? <p className="muted">Note: {row.review_note}</p> : null}
            <p className="muted">{formatClock(row.created_at)}</p>
            {row.status === "pending" ? (
              <div className="hero-actions">
                <form action={reviewClaim}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button className="btn btn-primary" type="submit">
                    Approve Claim
                  </button>
                </form>
                <form action={reviewClaim}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <input name="note" placeholder="Reason" />
                  <button className="btn btn-secondary" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

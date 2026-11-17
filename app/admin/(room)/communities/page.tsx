import { bulkCommunityAction } from "@/app/admin/bulk-actions";
import { BulkForm } from "@/components/admin/BulkForm";
import { communityStatusLabel, listCommunities } from "@/lib/communities";
import { reviewCommunityClaim } from "@/app/community-tools-actions";
import { createServiceClient } from "@/lib/supabase/admin";

const QUEUES = ["all", "requested", "draft", "archived", "suspended"] as const;

const QUEUE_TITLE: Record<(typeof QUEUES)[number], string> = {
  all: "All",
  requested: "Requested",
  draft: "Drafts",
  archived: "Archived",
  suspended: "Suspended",
};

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status = "all", error } = await searchParams;
  const current = QUEUES.includes(status as (typeof QUEUES)[number])
    ? (status as (typeof QUEUES)[number])
    : "all";
  const rows = await listCommunities(current);
  const service = createServiceClient();
  const { data: claims } = service
    ? await service
        .from("community_claim_requests")
        .select("id, requested_by, evidence, created_at, communities(title)")
        .eq("status", "pending")
        .order("created_at")
    : { data: [] };
  const returnTo = current === "all" ? "/admin/communities" : `/admin/communities?status=${current}`;

  const list = (
    <div className="stack-list">
      {rows.map((row) => (
        <article key={row.id} className="cr-bulk-row">
          <input
            className="cr-bulk-check"
            type="checkbox"
            name="id"
            value={row.id}
            form="bulk-communities"
            aria-label={`Select ${row.title || "Untitled"}`}
          />
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <span className={`status-pill ${row.status}`}>{communityStatusLabel(row.status)}</span>
              <h2 style={{ marginTop: 8 }}>{row.title || "Untitled"}</h2>
              <p className="muted">
                {row.placeLabel || "Anywhere"}
                {row.interest ? ` · ${row.interest}` : ""}
              </p>
            </div>
            <a className="btn btn-primary" href={`/admin/communities/${row.id}`}>
              Edit
            </a>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <section>
      <p className="eyebrow">Content</p>
      <h1>Communities</h1>
      <p className="lede muted">{QUEUE_TITLE[current]}</p>
      {error ? <p className="error">{error}</p> : null}
      {(claims ?? []).length > 0 ? (
        <section style={{ marginBottom: 28 }}>
          <p className="eyebrow">Ownership Review</p>
          <h2>Community Claims</h2>
          <div className="stack-list">
            {(claims ?? []).map((claim) => {
              const community = Array.isArray(claim.communities) ? claim.communities[0] : claim.communities;
              return (
                <article className="cr-bulk-row" key={claim.id}>
                  <h3>{community?.title ?? "Community"}</h3>
                  <p>{claim.evidence || "No supporting detail supplied."}</p>
                  <p className="muted">Requester {claim.requested_by} · {new Date(claim.created_at).toLocaleDateString("en-ZA")}</p>
                  <form action={reviewCommunityClaim} className="hero-actions">
                    <input type="hidden" name="request_id" value={claim.id} />
                    <button className="btn btn-primary" name="decision" value="approve">Approve</button>
                    <button className="btn btn-secondary" name="decision" value="reject">Reject</button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p className="muted">Nothing in this queue.</p>
      ) : (
        <BulkForm
          formId="bulk-communities"
          noun="Community"
          nouns="Communities"
          action={bulkCommunityAction}
          returnTo={returnTo}
        >
          {list}
        </BulkForm>
      )}
    </section>
  );
}

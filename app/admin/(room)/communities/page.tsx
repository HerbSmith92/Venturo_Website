import { communityStatusLabel, listCommunities } from "@/lib/communities";

const QUEUES = ["all", "requested", "draft", "archived", "suspended"] as const;

const QUEUE_TITLE: Record<(typeof QUEUES)[number], string> = {
  all: "All",
  requested: "Requested",
  draft: "Changes Requested",
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

  return (
    <section>
      <p className="eyebrow">Content</p>
      <h1>Communities</h1>
      <p className="lede muted">{QUEUE_TITLE[current]}</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="stack-list">
        {rows.length === 0 ? <p className="muted">Nothing in this queue.</p> : null}
        {rows.map((row) => (
          <article key={row.id}>
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
    </section>
  );
}

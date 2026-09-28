import { saveCommunity } from "@/app/admin/content-actions";
import { listCommunities } from "@/lib/communities";

const TABS = ["all", "draft", "published", "archived"] as const;

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status = "all", error } = await searchParams;
  const current = TABS.includes(status as (typeof TABS)[number])
    ? (status as (typeof TABS)[number])
    : "all";
  const rows = await listCommunities(current);

  return (
    <section>
      <p className="eyebrow">Content</p>
      <h1>Communities</h1>
      <p className="lede muted">
        Publish a community here and the website and the app can follow the same record.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="chips" style={{ margin: "20px 0" }}>
        {TABS.map((tab) => (
          <a
            key={tab}
            className={`chip${current === tab ? " active" : ""}`}
            href={tab === "all" ? "/admin/communities" : `/admin/communities?status=${tab}`}
          >
            {tab === "all" ? "All" : tab}
          </a>
        ))}
      </div>
      <form action={saveCommunity} className="cr-panel" style={{ marginBottom: 24 }}>
        <h2>New Community</h2>
        <label className="field">
          <span>Title</span>
          <input name="title" required placeholder="Family Weekends" />
        </label>
        <label className="field">
          <span>About</span>
          <textarea name="about" rows={3} />
        </label>
        <button className="btn btn-primary" type="submit">
          Create Draft
        </button>
      </form>
      <div className="stack-list">
        {rows.length === 0 ? <p className="muted">No communities in this list.</p> : null}
        {rows.map((row) => (
          <article key={row.id}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div>
                <span className={`status-pill ${row.status}`}>{row.status}</span>
                <h2 style={{ marginTop: 8 }}>{row.title}</h2>
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

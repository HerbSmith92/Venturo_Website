import { getCurrentUser } from "@/lib/auth";
import { listPublishedCommunities } from "@/lib/communities";

export default async function CommunitiesPage() {
  const user = await getCurrentUser();
  const communities = await listPublishedCommunities();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">People First</p>
        <h1>Communities</h1>
        <p className="lede muted">
          Groups Control Room publishes. Follow one and it shows in My Venturo and in the app.
        </p>
        {communities.length === 0 ? (
          <p className="notice">Communities are on the way. Browse events while they land.</p>
        ) : (
          <div className="grid" style={{ marginTop: 28 }}>
            {communities.map((item) => (
              <a key={item.id} className="card" href={`/communities/${item.slug}`}>
                <div className="card-body">
                  <p className="card-kicker">Community</p>
                  <h3>{item.title}</h3>
                  <p className="card-meta">
                    {item.placeLabel || "South Africa"}
                    {item.interest ? ` · ${item.interest}` : ""}
                  </p>
                  {item.about ? <p className="muted">{item.about.slice(0, 140)}</p> : null}
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="hero-actions" style={{ marginTop: 32 }}>
          {user ? (
            <a className="btn btn-primary" href="/account/communities">
              Followed Communities
            </a>
          ) : (
            <a className="btn btn-primary" href="/signup">
              Sign Up Free
            </a>
          )}
          <a className="btn btn-secondary" href="/events">
            See What&apos;s On
          </a>
        </div>
      </section>
    </main>
  );
}

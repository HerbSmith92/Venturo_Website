import { getCurrentUser } from "@/lib/auth";
import { listPublishedCommunities } from "@/lib/communities";
import { DiscoverBanner } from "@/components/DiscoverBanner";
import { loadWebsiteCopy } from "@/lib/website";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const user = await getCurrentUser();
  const query = q.trim().toLowerCase();
  const [published, website] = await Promise.all([listPublishedCommunities(), loadWebsiteCopy()]);
  const communities = published.filter((item) => {
    if (!query) return true;
    return [item.title, item.placeLabel, item.interest, item.about]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const banner = website.communitiesBanner;

  return (
    <main className="shell">
      <DiscoverBanner
        eyebrow={banner.eyebrow}
        title={banner.title}
        copy={banner.copy}
        image={banner.imageUrl}
        imageAlt={banner.imageAlt}
        actions={[
          { label: "Explore communities", href: "#community-results", primary: true },
          { label: "List your community", href: user ? "/account/community" : "/login?next=/account/community" },
        ]}
      />
      <section className="section" id="community-results">
        <form className="field" method="get" action="/communities">
          <span>Search communities</span>
          <input name="q" defaultValue={q} placeholder="Name, place, or interest" />
        </form>
        {communities.length === 0 ? (
          <p className="notice">Nothing matches that search yet.</p>
        ) : (
          <div className="grid" style={{ marginTop: 28 }}>
            {communities.map((item) => (
              <a key={item.id} className="card" href={`/communities/${item.slug}`}>
                <div className="card-image card-image-post">
                  {item.coverUrl ? <img src={item.coverUrl} alt="" /> : <span className="community-card-fallback" />}
                </div>
                <div className="card-body">
                  <p className="card-kicker">Community</p>
                  <h3>{item.title}</h3>
                  <p className="card-meta">
                    {item.placeLabel || "South Africa"}
                    {item.interest ? ` · ${item.interest}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="hero-actions" style={{ marginTop: 32 }}>
          <a
            className="btn btn-primary"
            href={user ? "/account/community" : "/login?next=/account/community"}
          >
            List Your Community
          </a>
          {user ? (
            <a className="btn btn-secondary" href="/account/communities">
              Your Communities
            </a>
          ) : null}
          <a className="btn btn-secondary" href="/events">
            See What&apos;s On
          </a>
        </div>
      </section>
    </main>
  );
}

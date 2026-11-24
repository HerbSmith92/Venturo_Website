import { getCurrentUser } from "@/lib/auth";
import { loadAudienceViewer } from "@/lib/audience";
import { listVisiblePublishedCommunities } from "@/lib/communities";
import { DiscoverBanner } from "@/components/DiscoverBanner";
import { GenderAudienceRow } from "@/components/search/GenderAudienceRow";
import { loadWebsiteCopy } from "@/lib/website";

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const user = await getCurrentUser();
  const query = q.trim().toLowerCase();
  const [published, website, audienceViewer] = await Promise.all([
    listVisiblePublishedCommunities(),
    loadWebsiteCopy(),
    loadAudienceViewer(),
  ]);
  const communities = published.filter((item) => {
    if (!query) return true;
    return [item.title, item.placeLabel, item.interest, item.about]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const browsing = !query;
  const forWomen =
    browsing && audienceViewer.canViewWomen
      ? communities.filter((item) => item.audience === "women").slice(0, 10)
      : [];
  const forMen =
    browsing && audienceViewer.canViewMen
      ? communities.filter((item) => item.audience === "men").slice(0, 10)
      : [];
  const banner = website.communitiesBanner;

  function communityCard(item: (typeof communities)[number]) {
    return (
      <a className="card" href={`/communities/${item.slug}`}>
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
    );
  }

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
        {forWomen.length > 0 ? (
          <GenderAudienceRow title="For Women" viewAllHref="/search?tab=communities&audience=women">
            {forWomen.map((item) => (
              <div key={item.id} className="taste-rail-item">
                {communityCard(item)}
              </div>
            ))}
          </GenderAudienceRow>
        ) : null}
        {forMen.length > 0 ? (
          <GenderAudienceRow title="For Men" viewAllHref="/search?tab=communities&audience=men">
            {forMen.map((item) => (
              <div key={item.id} className="taste-rail-item">
                {communityCard(item)}
              </div>
            ))}
          </GenderAudienceRow>
        ) : null}
        {communities.length === 0 ? (
          <p className="notice">Nothing matches that search yet.</p>
        ) : (
          <div className="grid" style={{ marginTop: 28 }}>
            {communities.map((item) => (
              <div key={item.id}>{communityCard(item)}</div>
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

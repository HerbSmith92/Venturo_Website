import { CategoryChips } from "@/components/CategoryChips";
import { DirectorySearch } from "@/components/DirectorySearch";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { searchDirectory } from "@/lib/listings";
import { isStaff } from "@/lib/roles";
import {
  isDirectorySearch,
  recordDirectorySearch,
  VISITOR_COOKIE,
  visitorKeyFromCookie,
} from "@/lib/search-misses";
import { cookies, headers } from "next/headers";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    place?: string;
    price?: string;
    sort?: string;
    lat?: string;
    lng?: string;
  }>;
}) {
  const query = await searchParams;
  const category = query.category ?? "all";
  const user = await getCurrentUser();
  const listings = await searchDirectory({ ...query, category });
  const revealMember = user?.plan === "paid" || isStaff(user?.role);
  const browsing = category === "all" && !query.q && !query.place && !query.price && !query.lat;
  const featured = listings.filter((listing) => listing.featured).slice(0, 6);
  const hot = [...listings]
    .filter((listing) => !listing.featured && (listing.rating ?? 0) > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);
  if (isDirectorySearch({ ...query, category })) {
    const headerList = await headers();
    const prefetch =
      headerList.get("next-router-prefetch") === "1" ||
      headerList.get("next-router-segment-prefetch") === "1" ||
      headerList.get("purpose") === "prefetch" ||
      headerList.get("sec-purpose") === "prefetch";
    const ua = headerList.get("user-agent") ?? "";
    const bot = !ua || /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|embedly/i.test(ua);
    if (!prefetch && !bot) {
      const store = await cookies();
      await recordDirectorySearch({
        userId: user?.id ?? null,
        visitorKey: visitorKeyFromCookie(store.get(VISITOR_COOKIE)?.value),
        platform: "web",
        query: { ...query, category },
        resultCount: listings.length,
      });
    }
  }

  return (
    <main className="shell">
      <section className="discover-banner">
        <img src="/brand/landing/next-adventure.jpg" alt="" />
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Find places to go &amp; things to do</h1>
        </div>
      </section>
      <section className="section">
        <DirectorySearch
          q={query.q ?? ""}
          place={query.place ?? ""}
          price={query.price ?? ""}
          sort={query.sort ?? ""}
          category={category}
        />
        <CategoryChips active={category} />
        {listings.length === 0 ? (
          <p className="notice">Nothing matches that search. Try a wider place or clear the price.</p>
        ) : browsing ? (
          <>
            {featured.length > 0 ? (
              <div className="discover-row">
                <h2>Featured</h2>
                <div className="grid">
                  {featured.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} href={`/directory/${listing.slug}`} showMemberPrice={revealMember} />
                  ))}
                </div>
              </div>
            ) : null}
            {hot.length > 0 ? (
              <div className="discover-row">
                <h2>Hot</h2>
                <div className="grid">
                  {hot.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} href={`/directory/${listing.slug}`} showMemberPrice={revealMember} />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="discover-row">
              <h2>All places</h2>
              <div className="grid">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} href={`/directory/${listing.slug}`} showMemberPrice={revealMember} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="grid">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/directory/${listing.slug}`}
                showMemberPrice={revealMember}
              />
            ))}
          </div>
        )}
        {!revealMember ? (
          <p className="notice" style={{ marginTop: 24 }}>
            <a href="/join/subscribe">Subscribe</a>
          </p>
        ) : null}
        <p style={{ marginTop: 20 }}>
          <a href="/list-your-business">List your business</a>
        </p>
      </section>
    </main>
  );
}

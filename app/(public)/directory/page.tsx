import { CategoryChips } from "@/components/CategoryChips";
import { DirectorySearch } from "@/components/DirectorySearch";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { searchDirectory } from "@/lib/listings";

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

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow" style={{ color: "var(--jade)" }}>
          Directory
        </p>
        <h1>Find Places To Go & Things To Do</h1>
        <p className="lede muted">
          The same live places the Venturo app shows. Save one and it stays on your profile.
        </p>
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
            Member prices unlock with a subscription.{" "}
            <a href={user ? "/join/subscribe" : "/join"}>See membership</a>.
          </p>
        ) : null}
        <p style={{ marginTop: 20 }}>
          <a href="/list-your-business">List your business</a>
        </p>
      </section>
    </main>
  );
}

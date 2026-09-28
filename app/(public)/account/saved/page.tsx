import { AccountNav } from "@/components/AccountNav";
import { EventCard } from "@/components/EventCard";
import { GuideCard } from "@/components/GuideCard";
import { ListingCard } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { liveGuides } from "@/lib/guides";
import { listingsByCategory } from "@/lib/listings";
import { listSaves } from "@/lib/saves";
import { redirect } from "next/navigation";

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/saved");
  const saves = await listSaves(user.id);
  const [listings, events, guides] = await Promise.all([
    listingsByCategory("all"),
    Promise.all(
      saves.filter((row) => row.kind === "event").map((row) => getEventById(row.target_id)),
    ),
    liveGuides(),
  ]);
  const listingIds = new Set(saves.filter((row) => row.kind === "listing").map((row) => row.target_id));
  const guideIds = new Set(saves.filter((row) => row.kind === "guide").map((row) => row.target_id));
  const savedListings = listings.filter((listing) => listingIds.has(listing.id));
  const savedGuides = guides.filter((guide) => guideIds.has(guide.id));
  const savedEvents = events.filter((event) => event && event.status === "approved");

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="saved" />
        <p className="eyebrow">My Venturo</p>
        <h1>Saved</h1>
        <p className="lede muted">Activities, events, and guides you keep. The app reads this same list.</p>
        {savedListings.length + savedGuides.length + savedEvents.length === 0 ? (
          <p className="muted">
            Nothing saved yet. <a href="/directory">Browse the directory</a>.
          </p>
        ) : null}
        {savedListings.length > 0 ? (
          <>
            <h2>Activities</h2>
            <div className="grid">
              {savedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  href={`/directory/${listing.slug}`}
                  showMemberPrice={user.plan === "paid"}
                />
              ))}
            </div>
          </>
        ) : null}
        {savedEvents.length > 0 ? (
          <>
            <h2>Events</h2>
            <div className="grid">
              {savedEvents.map((event) =>
                event ? (
                  <EventCard key={event.id} event={event} showMemberPrice={user.plan === "paid"} />
                ) : null,
              )}
            </div>
          </>
        ) : null}
        {savedGuides.length > 0 ? (
          <>
            <h2>Guides</h2>
            <div className="guide-grid">
              {savedGuides.map((guide) => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

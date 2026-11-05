import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/reviews");
  const supabase = await createClient();
  const listingResult = supabase
    ? await supabase
        .from("listing_reviews")
        .select("id, rating, body, listing_id, directory_listings ( name, slug )")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as never[], error: null };
  const eventResult = supabase
    ? await supabase
        .from("event_reviews")
        .select("id, rating, body, event_id, events ( title, slug )")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as never[], error: null };
  const data = listingResult.data;
  const eventRows = eventResult.error ? [] : eventResult.data;
  const rows = (data ?? []) as {
    id: string;
    rating: number;
    body: string;
    directory_listings?: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  }[];
  const events = (eventRows ?? []) as {
    id: string;
    rating: number;
    body: string;
    event_id: string;
    events?: { title?: string; slug?: string } | { title?: string; slug?: string }[] | null;
  }[];

  return (
    <>
        <p className="eyebrow">My Venturo</p>
        <h1>Reviews</h1>
        {rows.length === 0 && events.length === 0 ? (
          <p className="muted">
            You have not written a Venturo review yet. After an event you attended, we ask you how it was. Activity pages still show Google ratings where we have them.
          </p>
        ) : null}
        <ul className="stack-list">
          {events.map((row) => {
            const event = Array.isArray(row.events) ? row.events[0] : row.events;
            return (
              <li key={row.id}>
                <strong>
                  <a href={`/account/reviews/event/${row.event_id}`}>{event?.title || "Event"}</a> · {row.rating}/5
                </strong>
                <p>{row.body}</p>
              </li>
            );
          })}
          {rows.map((row) => {
            const listing = Array.isArray(row.directory_listings)
              ? row.directory_listings[0]
              : row.directory_listings;
            return (
              <li key={row.id}>
                <strong>
                  {listing?.slug ? <a href={`/directory/${listing.slug}`}>{listing.name}</a> : "Listing"} ·{" "}
                  {row.rating}/5
                </strong>
                <p>{row.body}</p>
              </li>
            );
          })}
        </ul>
    </>
  );
}

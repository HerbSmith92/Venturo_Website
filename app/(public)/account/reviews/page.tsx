import { AccountNav } from "@/components/AccountNav";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/reviews");
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("listing_reviews")
        .select("id, rating, body, listing_id, directory_listings ( name, slug )")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const rows = (data ?? []) as {
    id: string;
    rating: number;
    body: string;
    directory_listings?: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  }[];

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="reviews" />
        <p className="eyebrow">My Venturo</p>
        <h1>Reviews</h1>
        {rows.length === 0 ? <p className="muted">You have not written a review yet.</p> : null}
        <ul className="stack-list">
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
      </section>
    </main>
  );
}

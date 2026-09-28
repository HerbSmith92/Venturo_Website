import { AccountNav } from "@/components/AccountNav";
import { getCurrentUser } from "@/lib/auth";
import { listFollowedCommunityIds, listPublishedCommunities } from "@/lib/communities";
import { redirect } from "next/navigation";

export default async function AccountCommunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/communities");
  const [ids, communities] = await Promise.all([
    listFollowedCommunityIds(user.id),
    listPublishedCommunities(),
  ]);
  const followed = communities.filter((community) => ids.includes(community.id));

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="communities" />
        <p className="eyebrow">My Venturo</p>
        <h1>Communities</h1>
        {followed.length === 0 ? (
          <p className="muted">
            You are not following a community yet. <a href="/communities">Browse communities</a>.
          </p>
        ) : (
          <ul>
            {followed.map((community) => (
              <li key={community.id}>
                <a href={`/communities/${community.slug}`}>{community.title}</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

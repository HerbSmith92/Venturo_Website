import { getCurrentUser } from "@/lib/auth";
import { listClaimedCommunities, listFollowedCommunityIds, listPublishedCommunities } from "@/lib/communities";
import { redirect } from "next/navigation";

export default async function AccountCommunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/communities");
  const [ids, communities, claimed] = await Promise.all([
    listFollowedCommunityIds(user.id),
    listPublishedCommunities(),
    listClaimedCommunities(user.id),
  ]);
  const followed = communities.filter((community) => ids.includes(community.id));

  return (
    <>
        <p className="eyebrow">My Venturo</p>
        <h1>Communities</h1>
        <h2>Yours</h2>
        {claimed.length === 0 ? (
          <p className="muted">
            You have not claimed a community yet. Open one and choose Claim This Community.
          </p>
        ) : (
          <ul>
            {claimed.map((community) => (
              <li key={community.id}>
                <a href={`/account/communities/${community.id}`}>{community.title}</a>
              </li>
            ))}
          </ul>
        )}
        <h2>Following</h2>
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
    </>
  );
}

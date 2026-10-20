import { ClaimCommunityForm } from "@/components/communities/ClaimCommunityForm";
import { claimCommunityNow } from "@/app/community-claim-actions";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug } from "@/lib/communities";
import { isSupabaseConfigured } from "@/lib/env";
import { notFound, redirect } from "next/navigation";

export default async function ClaimCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const community = await getCommunityBySlug(slug);
  if (!community || community.status !== "published") notFound();

  const user = await getCurrentUser();
  if (user && community.claimedBy === user.id) redirect(`/account/communities/${community.id}`);

  return (
    <main className="shell">
      <section className="section">
        {community.claimedBy && community.claimedBy !== user?.id ? (
          <>
            <p className="eyebrow">Community</p>
            <h1>Already Claimed</h1>
            <p className="lede muted">{community.title} already has an owner.</p>
            <a className="btn btn-secondary" href={`/communities/${community.slug}`}>
              Back To The Community
            </a>
          </>
        ) : user ? (
          <>
            <p className="eyebrow">Community</p>
            <h1>Claim {community.title}</h1>
            <p className="lede muted">
              You are signed in as {user.email}. Claim it to edit the page & add events.
            </p>
            {error ? <p className="error">{error}</p> : null}
            <form action={claimCommunityNow}>
              <input type="hidden" name="id" value={community.id} />
              <input type="hidden" name="slug" value={community.slug} />
              <button className="btn btn-primary" type="submit">
                Claim This Community
              </button>
            </form>
          </>
        ) : (
          <>
            {error ? <p className="error">{error}</p> : null}
            <ClaimCommunityForm
              communityId={community.id}
              communityTitle={community.title}
              communitySlug={community.slug}
              configured={isSupabaseConfigured()}
            />
          </>
        )}
      </section>
    </main>
  );
}

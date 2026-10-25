import { addClaimedCommunityEvent } from "@/app/community-claim-actions";
import { CommunityForm } from "@/components/profile/CommunityForm";
import { FoldSection } from "@/components/profile/FoldSection";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityById, listCommunityEventLinks } from "@/lib/communities";
import { portalEventHref } from "@/lib/portal";
import { notFound, redirect } from "next/navigation";

export default async function ClaimedCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { id } = await params;
  const { done, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/communities/${id}`);
  const community = await getCommunityById(id);
  if (!community || community.claimedBy !== user.id) notFound();
  const events = await listCommunityEventLinks(community.id);

  return (
    <>
        <p className="eyebrow">Your Community</p>
        <h1>{community.title}</h1>
        <p className="lede muted">
          Community Details, Founder Details, then Contact &amp; Socials.
        </p>
        {done ? <p className="notice">Saved.</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <CommunityForm
          id={community.id}
          title={community.title}
          about={community.about ?? ""}
          areas={community.areas}
          founderName={community.founderName ?? ""}
          founderEmail={community.founderEmail ?? ""}
          contactEmail={community.contactEmail ?? ""}
          phone={community.phone ?? ""}
          websiteUrl={community.websiteUrl ?? ""}
          instagramUrl={community.instagramUrl ?? ""}
          facebookUrl={community.facebookUrl ?? ""}
          tiktokUrl={community.tiktokUrl ?? ""}
        />

        <div className="community-events-wrap">
          <div className="cr-paper community-events-card">
            <FoldSection title="Events">
              <p className="cr-about-label">
                The event is linked to this community. It goes on the public page once the event itself is live.
              </p>
              <form action={addClaimedCommunityEvent}>
                <input type="hidden" name="id" value={community.id} />
                <label className="field cr-quiet">
                  <span className="sr-only">Event Name</span>
                  <input name="title" required placeholder="Event Name" aria-label="Event Name" />
                </label>
                <div className="community-setup-actions">
                  <button className="btn btn-primary" type="submit">
                    Add Event
                  </button>
                </div>
              </form>
              {events.length === 0 ? (
                <p className="cr-about-label">No events linked yet.</p>
              ) : (
                <ul className="community-event-links">
                  {events.map((event) => (
                    <li key={event.id}>
                      <a href={portalEventHref(event.id)}>{event.title}</a>
                      <span> · {event.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="community-setup-actions">
                {community.status === "published" ? (
                  <a className="btn btn-secondary" href={`/communities/${community.slug}`}>
                    View Public Page
                  </a>
                ) : (
                  <span className="notice">
                    {community.status === "requested"
                      ? "Pending approval. The public page opens once Venturo publishes this community."
                      : "This community is not on the public page yet."}
                  </span>
                )}
              </p>
            </FoldSection>
          </div>
        </div>
    </>
  );
}

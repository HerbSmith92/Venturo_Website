import { addClaimedCommunityEvent, saveClaimedCommunity } from "@/app/community-claim-actions";
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
          Update the public page, then add the events this group is hosting.
        </p>
        {done ? <p className="notice">Saved.</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <form className="auth-card" action={saveClaimedCommunity}>
          <input type="hidden" name="id" value={community.id} />
          <label className="field">
            <span>Community Name</span>
            <input name="title" defaultValue={community.title} required />
          </label>
          <label className="field">
            <span>About</span>
            <textarea name="about" rows={5} defaultValue={community.about ?? ""} />
          </label>
          <label className="field">
            <span>Areas</span>
            <textarea
              name="areas"
              rows={3}
              defaultValue={community.areas.join("\n")}
              placeholder={"Sandton\nRosebank"}
            />
          </label>
          <label className="field">
            <span>Contact Email</span>
            <input name="contact_email" type="email" defaultValue={community.contactEmail ?? ""} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" defaultValue={community.phone ?? ""} />
          </label>
          <label className="field">
            <span>Website</span>
            <input name="website_url" defaultValue={community.websiteUrl ?? ""} />
          </label>
          <label className="field">
            <span>Instagram</span>
            <input name="instagram_url" defaultValue={community.instagramUrl ?? ""} />
          </label>
          <label className="field">
            <span>Facebook</span>
            <input name="facebook_url" defaultValue={community.facebookUrl ?? ""} />
          </label>
          <label className="field">
            <span>TikTok</span>
            <input name="tiktok_url" defaultValue={community.tiktokUrl ?? ""} />
          </label>
          <label className="field">
            <span>Founder Name</span>
            <input name="founder_name" defaultValue={community.founderName ?? ""} />
          </label>
          <label className="field">
            <span>Founder Email</span>
            <input name="founder_email" type="email" defaultValue={community.founderEmail ?? ""} />
          </label>
          <button className="btn btn-primary" type="submit">
            Save Community
          </button>
        </form>

        <div className="community-events">
          <p className="eyebrow">Events</p>
          <h2>Add An Event</h2>
          <p className="muted">
            The event is linked to this community. It goes on the public page once the event itself is live.
          </p>
          <form className="auth-card" action={addClaimedCommunityEvent}>
            <input type="hidden" name="id" value={community.id} />
            <label className="field">
              <span>Event Name</span>
              <input name="title" required placeholder="Sunrise Hike" />
            </label>
            <button className="btn btn-primary" type="submit">
              Add Event
            </button>
          </form>
          {events.length === 0 ? (
            <p className="muted">No events linked yet.</p>
          ) : (
            <ul className="stack-list">
              {events.map((event) => (
                <li key={event.id}>
                  <a href={portalEventHref(event.id)}>{event.title}</a>
                  <span className="muted"> · {event.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p style={{ marginTop: 28 }}>
          <a className="btn btn-secondary" href={`/communities/${community.slug}`}>
            View Public Page
          </a>
        </p>
    </>
  );
}

import { saveWebsite } from "@/app/admin/content-actions";
import { listCommunities } from "@/lib/communities";
import { listPublicEvents } from "@/lib/events";
import { liveGuides } from "@/lib/guides";
import { loadQueue } from "@/lib/control-room";
import { loadFeatureIds, loadWebsiteCopy } from "@/lib/website";

export default async function WebsiteControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const [copy, features, listings, events, communities, guides] = await Promise.all([
    loadWebsiteCopy(),
    loadFeatureIds(),
    loadQueue("approved"),
    listPublicEvents({ limit: 40 }),
    listCommunities("published"),
    liveGuides(40),
  ]);
  const picked = {
    event: new Set(features.event),
    listing: new Set(features.listing),
    community: new Set(features.community),
    guide: new Set(features.guide),
  };

  return (
    <section>
      <p className="eyebrow">Content</p>
      <h1>Website</h1>
      <p className="lede muted">
        What you publish here is the home page. The app reads the same featured lists.
        An empty list falls back to the newest live items.
      </p>
      {done ? <p className="notice">Website controls saved.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <form action={saveWebsite} className="cr-panel">
        <h2>Hero</h2>
        <label className="field">
          <span>Eyebrow</span>
          <input name="hero_eyebrow" defaultValue={copy.heroEyebrow} />
        </label>
        <label className="field">
          <span>Title</span>
          <input name="hero_title" defaultValue={copy.heroTitle} />
        </label>
        <label className="field">
          <span>Lede</span>
          <textarea name="hero_lede" rows={3} defaultValue={copy.heroLede} />
        </label>
        <label className="field">
          <span>Hero image URL</span>
          <input name="hero_image_url" defaultValue={copy.heroImageUrl} />
        </label>

        <h2>Featured On Home</h2>
        <fieldset>
          <legend>Events</legend>
          {events.map((event) => (
            <label key={event.id} className="field">
              <span>
                <input type="checkbox" name="event_id" value={event.id} defaultChecked={picked.event.has(event.id)} />{" "}
                {event.title}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Activities</legend>
          {listings.slice(0, 40).map((listing) => (
            <label key={listing.id} className="field">
              <span>
                <input
                  type="checkbox"
                  name="listing_id"
                  value={listing.id}
                  defaultChecked={picked.listing.has(listing.id)}
                />{" "}
                {listing.name}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Communities</legend>
          {communities.map((community) => (
            <label key={community.id} className="field">
              <span>
                <input
                  type="checkbox"
                  name="community_id"
                  value={community.id}
                  defaultChecked={picked.community.has(community.id)}
                />{" "}
                {community.title}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Guides</legend>
          {guides.map((guide) => (
            <label key={guide.id} className="field">
              <span>
                <input type="checkbox" name="guide_id" value={guide.id} defaultChecked={picked.guide.has(guide.id)} />{" "}
                {guide.title}
              </span>
            </label>
          ))}
        </fieldset>

        <h2>About, Help & The App</h2>
        <label className="field">
          <span>About title</span>
          <input name="about_title" defaultValue={copy.aboutTitle} />
        </label>
        <label className="field">
          <span>About</span>
          <textarea name="about_body" rows={5} defaultValue={copy.aboutBody} />
        </label>
        <label className="field">
          <span>Help title</span>
          <input name="help_title" defaultValue={copy.helpTitle} />
        </label>
        <label className="field">
          <span>Help</span>
          <textarea name="help_body" rows={4} defaultValue={copy.helpBody} />
        </label>
        <label className="field">
          <span>Help email</span>
          <input name="help_email" type="email" defaultValue={copy.helpEmail} />
        </label>
        <label className="field">
          <span>App Store URL</span>
          <input name="app_store_url" defaultValue={copy.appStoreUrl} />
        </label>
        <label className="field">
          <span>Play Store URL</span>
          <input name="play_store_url" defaultValue={copy.playStoreUrl} />
        </label>
        <button className="btn btn-primary" type="submit">
          Save Website
        </button>
      </form>
    </section>
  );
}

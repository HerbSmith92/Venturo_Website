import { notFound } from "next/navigation";
import { saveCommunity } from "@/app/admin/content-actions";
import { getCommunityById, listCommunityEventIds } from "@/lib/communities";
import { listAdminEvents } from "@/lib/events";

export default async function AdminCommunityEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const community = await getCommunityById(id);
  if (!community) notFound();
  const [linked, events] = await Promise.all([
    listCommunityEventIds(id),
    listAdminEvents("approved"),
  ]);
  const linkedSet = new Set(linked);

  return (
    <section>
      <p className="eyebrow">
        <a href="/admin/communities">Communities</a>
      </p>
      <h1>{community.title}</h1>
      {done ? <p className="notice">Saved. A published community is live on the website and ready for the app.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <form action={saveCommunity} className="cr-panel">
        <input type="hidden" name="id" value={community.id} />
        <label className="field">
          <span>Title</span>
          <input name="title" required defaultValue={community.title} />
        </label>
        <label className="field">
          <span>Slug</span>
          <input name="slug" defaultValue={community.slug} />
        </label>
        <label className="field">
          <span>About</span>
          <textarea name="about" rows={5} defaultValue={community.about ?? ""} />
        </label>
        <label className="field">
          <span>Cover image URL</span>
          <input name="cover_url" defaultValue={community.coverUrl ?? ""} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Interest</span>
            <input name="interest" defaultValue={community.interest ?? ""} />
          </label>
          <label className="field">
            <span>Place</span>
            <input name="place_label" defaultValue={community.placeLabel ?? ""} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Website</span>
            <input name="website_url" type="url" defaultValue={community.websiteUrl ?? ""} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" type="tel" defaultValue={community.phone ?? ""} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Instagram</span>
            <input name="instagram_url" defaultValue={community.instagramUrl ?? ""} />
          </label>
          <label className="field">
            <span>Facebook</span>
            <input name="facebook_url" defaultValue={community.facebookUrl ?? ""} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Social link</span>
            <input name="social_url" defaultValue={community.socialUrl ?? ""} />
          </label>
          <label className="field">
            <span>Contact email</span>
            <input name="contact_email" type="email" defaultValue={community.contactEmail ?? ""} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Founder name</span>
            <input name="founder_name" defaultValue={community.founderName ?? ""} />
          </label>
          <label className="field">
            <span>Founder email</span>
            <input name="founder_email" type="email" defaultValue={community.founderEmail ?? ""} />
          </label>
        </div>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={community.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field">
          <span>
            <input type="checkbox" name="is_featured" defaultChecked={community.isFeatured} /> Featured
          </span>
        </label>
        <fieldset>
          <legend>Linked events</legend>
          <p className="muted">Coming events show under Hosting. Ones that have ended show under Hosted.</p>
          {events.length === 0 ? <p className="muted">No live events to link yet.</p> : null}
          {events.map((event) => (
            <label key={event.id} className="field">
              <span>
                <input type="checkbox" name="event_id" value={event.id} defaultChecked={linkedSet.has(event.id)} />{" "}
                {event.title}
              </span>
            </label>
          ))}
        </fieldset>
        <button className="btn btn-primary" type="submit">
          Save Community
        </button>
      </form>
    </section>
  );
}

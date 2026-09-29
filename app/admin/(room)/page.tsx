import { controlRoomStats } from "@/lib/control-room";

export default async function ControlRoomHome() {
  const stats = await controlRoomStats();

  return (
    <section>
      <p className="eyebrow">Staff</p>
      <h1>Control Room</h1>
      <p className="lede muted">
        Directory and Events are the two desks. The public site is being rebuilt one screen at a time.
      </p>
      <div className="cr-board">
        <h2>Directory</h2>
        <div className="cr-stats">
          <a className="cr-stat" href="/admin/listings?status=approved">
            <span>Live</span>
            <strong>{stats.live}</strong>
          </a>
          <a className="cr-stat" href="/admin/listings?status=review">
            <span>In Review</span>
            <strong>{stats.review}</strong>
          </a>
          <a className="cr-stat" href="/admin/listings?status=draft">
            <span>Drafts</span>
            <strong>{stats.draft}</strong>
          </a>
          <a className="cr-stat" href="/admin/listings?status=archived">
            <span>Archived</span>
            <strong>{stats.archived}</strong>
          </a>
        </div>
      </div>
      <div className="cr-board">
        <h2>Events</h2>
        <div className="cr-stats">
          <a className="cr-stat" href="/admin/events?status=review">
            <span>In Review</span>
            <strong>{stats.eventsReview}</strong>
          </a>
          <a className="cr-stat" href="/admin/events">
            <span>All Events</span>
            <strong>Open</strong>
          </a>
        </div>
      </div>
    </section>
  );
}

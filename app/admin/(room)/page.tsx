import { controlRoomStats } from "@/lib/control-room";

export default async function ControlRoomHome() {
  const stats = await controlRoomStats();

  return (
    <section>
      <p className="eyebrow">Website, Directory & Memberships</p>
      <h1>Control Room</h1>
      <p className="lede muted">
        Approve listings & member-hosted events, feature Top Picks, & read
        enquiries. Publish is a staff action — hosts cannot go live themselves.
      </p>
      <div className="cr-board">
        <h2>Content</h2>
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
            <span>Changes Requested</span>
            <strong>{stats.draft}</strong>
          </a>
          <a className="cr-stat" href="/admin/events?status=review">
            <span>Events In Review</span>
            <strong>{stats.eventsReview}</strong>
          </a>
          <a className="cr-stat" href="/admin/listings?status=archived">
            <span>Archived</span>
            <strong>{stats.archived}</strong>
          </a>
        </div>
      </div>
      <div className="cr-board">
        <h2>Operations</h2>
        <div className="cr-stats">
          <a className="cr-stat" href="/admin/members">
            <span>Members</span>
            <strong>{stats.members}</strong>
          </a>
          <a className="cr-stat" href="/admin/enquiries">
            <span>Enquiries</span>
            <strong>{stats.enquiries}</strong>
          </a>
          <a className="cr-stat" href="/admin/claims">
            <span>Claims</span>
            <strong>Open</strong>
          </a>
        </div>
      </div>
    </section>
  );
}

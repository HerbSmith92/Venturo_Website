import { createCuratedGuide, duplicateCuratedGuide } from "@/app/admin/guide-actions";
import { loadGuideQueue } from "@/lib/control-room-guides";
import { formatClock } from "@/lib/control-room-shared";
import {
  formatGuideWindow,
  guideStatusLabel,
  type GuideStatus,
} from "@/lib/guide-shared";

const TABS: { id: "" | GuideStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];

export default async function GuidesQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status = "", error } = await searchParams;
  const guides = await loadGuideQueue(status);

  return (
    <section>
      <p className="eyebrow">Control Room</p>
      <h1>Curated Guides</h1>
      <p className="lede muted">
        Build weekend lists from live directory listings. Duplicate last week’s
        guide instead of starting from scratch.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="cr-actions">
        <form action={createCuratedGuide}>
          <button className="btn btn-primary" type="submit">
            New Guide
          </button>
        </form>
      </div>
      <div className="cr-tabs">
        {TABS.map((tab) => {
          const href = tab.id ? `/admin/guides?status=${tab.id}` : "/admin/guides";
          const active = status === tab.id;
          return (
            <a key={tab.label} className={active ? "cr-tab active" : "cr-tab"} href={href}>
              {tab.label}
            </a>
          );
        })}
      </div>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Guide</th>
              <th>Window</th>
              <th>Status</th>
              <th>Spots</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {guides.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No guides in this queue yet.
                </td>
              </tr>
            )}
            {guides.map((guide) => (
              <tr key={guide.id}>
                <td>
                  <a href={`/admin/guides/${guide.id}`}>{guide.title}</a>
                  <div className="muted">{guide.slug}</div>
                </td>
                <td>{formatGuideWindow(guide.publish_at, guide.expire_at)}</td>
                <td>
                  <span className={`cr-pill status-${guide.status === "published" ? "approved" : guide.status}`}>
                    {guideStatusLabel(guide.status)}
                  </span>
                </td>
                <td>{guide.item_count}</td>
                <td>{formatClock(guide.updated_at)}</td>
                <td>
                  <div className="cr-actions cr-queue-actions">
                    <a className="btn btn-secondary" href={`/admin/guides/${guide.id}`}>
                      Edit
                    </a>
                    <form action={duplicateCuratedGuide}>
                      <input type="hidden" name="id" value={guide.id} />
                      <button className="btn btn-secondary" type="submit">
                        Duplicate
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

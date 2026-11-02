import {
  applyEventGuideAction,
  duplicateCuratedEventGuide,
} from "@/app/admin/event-guide-actions";
import type { GuideStatus } from "@/lib/guide-shared";

export function EventGuideActions({
  guideId,
  status,
  canPublish = true,
}: {
  guideId: string;
  status: GuideStatus;
  canPublish?: boolean;
}) {
  return (
    <div className="cr-actions">
      {canPublish && status !== "published" && (
        <form action={applyEventGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="publish" />
          <button className="btn btn-primary" type="submit">
            Publish
          </button>
        </form>
      )}
      {canPublish && status === "published" && (
        <form action={applyEventGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="unpublish" />
          <button className="btn btn-secondary" type="submit">
            Unpublish
          </button>
        </form>
      )}
      {canPublish && status !== "archived" && (
        <form action={applyEventGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="archive" />
          <button className="btn btn-secondary" type="submit">
            Archive
          </button>
        </form>
      )}
      <form action={duplicateCuratedEventGuide}>
        <input type="hidden" name="id" value={guideId} />
        <button className="btn btn-secondary" type="submit">
          Duplicate Guide
        </button>
      </form>
    </div>
  );
}

import {
  applyGuideAction,
  duplicateCuratedGuide,
} from "@/app/admin/guide-actions";
import type { GuideStatus } from "@/lib/guide-shared";

export function GuideActions({
  guideId,
  status,
  onExportInstagram,
  canPublish = true,
}: {
  guideId: string;
  status: GuideStatus;
  onExportInstagram?: () => void;
  canPublish?: boolean;
}) {
  return (
    <div className="cr-actions">
      {canPublish && status !== "published" && (
        <form action={applyGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="publish" />
          <button className="btn btn-primary" type="submit">
            Publish
          </button>
        </form>
      )}
      {canPublish && status === "published" && (
        <form action={applyGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="unpublish" />
          <button className="btn btn-secondary" type="submit">
            Unpublish
          </button>
        </form>
      )}
      {canPublish && status !== "archived" && (
        <form action={applyGuideAction}>
          <input type="hidden" name="id" value={guideId} />
          <input type="hidden" name="action" value="archive" />
          <button className="btn btn-secondary" type="submit">
            Archive
          </button>
        </form>
      )}
      <form action={duplicateCuratedGuide}>
        <input type="hidden" name="id" value={guideId} />
        <button className="btn btn-secondary" type="submit">
          Duplicate Guide
        </button>
      </form>
      {onExportInstagram && (
        <button className="btn btn-secondary" type="button" onClick={onExportInstagram}>
          Export For Instagram
        </button>
      )}
    </div>
  );
}

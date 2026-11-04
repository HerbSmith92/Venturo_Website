import { toggleGuideLike } from "@/app/member-actions";
import type { GuideKind } from "@/lib/guide-engagement";
import { formatGuideTally } from "@/lib/guide-engagement";

export function GuideLikeForm({
  kind,
  guideId,
  liked,
  likeCount,
  next,
}: {
  kind: GuideKind;
  guideId: string;
  liked: boolean;
  likeCount: number;
  next: string;
}) {
  return (
    <form action={toggleGuideLike}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="guide_id" value={guideId} />
      <input type="hidden" name="next" value={next} />
      <button className={liked ? "btn btn-primary" : "btn btn-secondary"} type="submit">
        {liked ? "Liked" : "Like"}
        {likeCount > 0 ? ` · ${formatGuideTally(likeCount, "like", "likes")}` : ""}
      </button>
    </form>
  );
}

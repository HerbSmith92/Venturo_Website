import type { GuideQueueRow } from "@/lib/control-room-guides";

export const GUIDE_BOARD_STATUSES = ["published", "review", "changes", "draft", "scheduled", "archived"] as const;
export type GuideBoardStatus = (typeof GUIDE_BOARD_STATUSES)[number];

export function isUntitledGuide(title: string) {
  return title === "Untitled Guide" || title === "Untitled Event Guide";
}

export function guideBoardStatus(guide: GuideQueueRow): GuideBoardStatus {
  if (guide.status === "archived") return "archived";
  if (guide.status === "published") {
    if (guide.publish_at && Date.parse(guide.publish_at) > Date.now()) return "scheduled";
    return "published";
  }
  if (guide.status === "review") return "review";
  if (guide.status === "changes") return "changes";
  if (!isUntitledGuide(guide.title) && guide.item_count > 0) return "review";
  return "draft";
}

export function guideBoardStatusLabel(status: GuideBoardStatus) {
  if (status === "review") return "Awaiting review";
  if (status === "changes") return "Changes requested";
  if (status === "scheduled") return "Scheduled";
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export function guideBoardActionLabel(status: GuideBoardStatus, admin: boolean) {
  if (status === "review" && admin) return "Review guide";
  if (status === "draft" || status === "review") return "Continue editing";
  return "Edit guide";
}

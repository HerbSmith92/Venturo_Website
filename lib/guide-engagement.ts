export type GuideKind = "activities" | "events";
export type GuideSort = "newest" | "popular" | "viewed";

export function parseGuideSort(value: string | undefined): GuideSort {
  if (value === "popular" || value === "viewed") return value;
  return "newest";
}

export function formatGuideTally(count: number, singular: string, plural: string) {
  const amount = Math.max(0, Math.round(count));
  const label = amount === 1 ? singular : plural;
  return `${new Intl.NumberFormat("en-ZA").format(amount)} ${label}`;
}

export function sortGuideCards<T extends { publishAt?: string | null; likeCount?: number; viewCount?: number }>(
  guides: T[],
  sort: GuideSort,
): T[] {
  const copy = [...guides];
  copy.sort((a, b) => {
    if (sort === "popular") {
      const likes = (b.likeCount ?? 0) - (a.likeCount ?? 0);
      if (likes) return likes;
      const views = (b.viewCount ?? 0) - (a.viewCount ?? 0);
      if (views) return views;
    } else if (sort === "viewed") {
      const views = (b.viewCount ?? 0) - (a.viewCount ?? 0);
      if (views) return views;
      const likes = (b.likeCount ?? 0) - (a.likeCount ?? 0);
      if (likes) return likes;
    }
    const aTime = a.publishAt ? Date.parse(a.publishAt) : 0;
    const bTime = b.publishAt ? Date.parse(b.publishAt) : 0;
    return bTime - aTime;
  });
  return copy;
}

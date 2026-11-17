export type WalletTokenVersion = {
  id: string;
  status: "draft" | "published" | "archived";
  image_path: string;
  file_type: string | null;
  width_px: number | null;
  height_px: number | null;
  byte_size: number | null;
  notes: string | null;
  created_at: string;
  published_at: string | null;
};

export type AchievementAdmin = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  image_path: string | null;
  tier: string | null;
  criteria_kind: "attend_events" | "attend_occurrences";
  criteria: Record<string, unknown>;
  criteria_summary: string;
  token_reward: number;
  sort_order: number;
  status: "draft" | "published" | "archived";
  is_active: boolean;
  updated_at: string;
  earned_count: number;
};

export function achievementSummary(input: {
  criteria_kind: string;
  criteria: Record<string, unknown>;
}): string {
  const count = Math.max(1, Number(input.criteria.count) || 1);
  if (input.criteria_kind === "attend_occurrences") {
    return `Earn this achievement after checking in to ${count} distinct Venturo event occurrence${count === 1 ? "" : "s"} (scanned attendance).`;
  }
  return `Earn this achievement after attending ${count} distinct Venturo event${count === 1 ? "" : "s"} (scanned attendance, not RSVP alone).`;
}

import "server-only";

import {
  achievementSummary,
  type AchievementAdmin,
  type WalletTokenVersion,
} from "@/lib/wallet-types";
import { createServiceClient } from "@/lib/supabase/admin";

export type { AchievementAdmin, WalletTokenVersion } from "@/lib/wallet-types";
export { achievementSummary } from "@/lib/wallet-types";

export async function loadWalletTokenAdmin(): Promise<{
  published: WalletTokenVersion | null;
  drafts: WalletTokenVersion[];
  history: WalletTokenVersion[];
}> {
  const service = createServiceClient();
  if (!service) return { published: null, drafts: [], history: [] };
  const { data } = await service
    .from("wallet_token_artwork")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as WalletTokenVersion[];
  return {
    published: rows.find((row) => row.status === "published") ?? null,
    drafts: rows.filter((row) => row.status === "draft"),
    history: rows.filter((row) => row.status === "archived" || row.status === "published"),
  };
}

export async function loadAchievementsAdmin(): Promise<AchievementAdmin[]> {
  const service = createServiceClient();
  if (!service) return [];
  const [{ data: achievements }, { data: earned }] = await Promise.all([
    service.from("achievements").select("*").neq("status", "archived").order("sort_order").order("name"),
    service.from("member_achievements").select("achievement_id"),
  ]);
  const counts = new Map<string, number>();
  for (const row of earned ?? []) {
    counts.set(row.achievement_id, (counts.get(row.achievement_id) ?? 0) + 1);
  }
  return ((achievements ?? []) as Omit<AchievementAdmin, "earned_count">[]).map((row) => ({
    ...row,
    criteria: (row.criteria ?? {}) as Record<string, unknown>,
    earned_count: counts.get(row.id) ?? 0,
  }));
}

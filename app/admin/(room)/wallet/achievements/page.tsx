import { AchievementManager } from "@/components/admin/AchievementManager";
import { requireAdmin } from "@/lib/auth";
import { loadAchievementsAdmin } from "@/lib/wallet-admin";

export const dynamic = "force-dynamic";

export default async function WalletAchievementsPage() {
  await requireAdmin();
  const achievements = await loadAchievementsAdmin();
  return <AchievementManager initial={achievements} />;
}

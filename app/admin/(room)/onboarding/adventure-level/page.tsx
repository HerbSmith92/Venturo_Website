import { AdventureLevelManager } from "@/components/admin/AdventureLevelManager";
import { requireAdmin } from "@/lib/auth";
import { loadOnboardingCatalogAdmin } from "@/lib/onboarding-catalog-admin";

export const dynamic = "force-dynamic";

export default async function AdventureLevelPage() {
  await requireAdmin();
  const catalog = await loadOnboardingCatalogAdmin();
  return <AdventureLevelManager catalog={catalog} />;
}

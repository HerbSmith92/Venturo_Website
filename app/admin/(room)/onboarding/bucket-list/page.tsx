import { BucketListManager } from "@/components/admin/BucketListManager";
import { requireAdmin } from "@/lib/auth";
import { loadOnboardingCatalogAdmin } from "@/lib/onboarding-catalog-admin";

export const dynamic = "force-dynamic";

export default async function BucketListPage() {
  await requireAdmin();
  const catalog = await loadOnboardingCatalogAdmin();
  return <BucketListManager catalog={catalog} />;
}

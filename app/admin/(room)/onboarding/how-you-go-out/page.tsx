import { PersonaManager } from "@/components/admin/PersonaManager";
import { requireAdmin } from "@/lib/auth";
import { loadCatalogAdmin } from "@/lib/catalog-admin";

export const dynamic = "force-dynamic";

export default async function HowYouGoOutPage() {
  await requireAdmin();
  const catalog = await loadCatalogAdmin();

  return <PersonaManager catalog={catalog} />;
}

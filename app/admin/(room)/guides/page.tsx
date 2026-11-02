import { GuidesDashboard } from "@/components/admin/GuidesDashboard";
import { getStaffSession } from "@/lib/auth";
import { loadUnifiedGuideQueue } from "@/lib/control-room-guides";
import { isAdmin } from "@/lib/roles";

export default async function GuidesQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getStaffSession();
  const admin = isAdmin(session?.role);
  const guides = await loadUnifiedGuideQueue("", {
    id: session?.id ?? "",
    admin,
  });

  return <GuidesDashboard guides={guides} canAdmin={admin} error={error} />;
}

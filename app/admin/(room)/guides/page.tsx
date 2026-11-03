import { GuidesDashboard } from "@/components/admin/GuidesDashboard";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { loadUnifiedGuideQueue } from "@/lib/control-room-guides";
import { guideViewerFor } from "@/lib/guide-access";
import { isAdmin, isStaff } from "@/lib/roles";

export default async function GuidesQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getStaffSession();
  const admin = isAdmin(session?.role);
  const linkedAuthorId = session?.id ? await linkedAuthorIdForUser(session.id) : null;
  const guides = await loadUnifiedGuideQueue("", guideViewerFor(session ? { ...session, linkedAuthorId } : null));

  return <GuidesDashboard guides={guides} canAdmin={admin} staffView={isStaff(session?.role)} error={error} />;
}

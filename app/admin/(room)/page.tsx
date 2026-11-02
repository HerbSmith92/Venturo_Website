import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { loadControlRoomOverview } from "@/lib/overview/load";
import { isAdmin, isStaff } from "@/lib/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ControlRoomHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; platform?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  if (!isStaff(session?.role)) {
    const authorId = session ? await linkedAuthorIdForUser(session.id) : null;
    redirect(authorId ? "/admin/guides" : "/admin/denied");
  }
  const model = await loadControlRoomOverview(params, { admin: isAdmin(session?.role) });
  const notice = params.saved === "thresholds" ? "Thresholds saved." : params.error ?? null;
  return <OverviewDashboard model={model} notice={notice} />;
}

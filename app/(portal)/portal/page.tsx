import { PortalHomeDashboard } from "@/components/portal/PortalHomeDashboard";
import { getCurrentUser } from "@/lib/auth";
import { PORTAL_LOGIN } from "@/lib/portal";
import { getPortalHome, parsePortalRange } from "@/lib/portal-home";
import { redirect } from "next/navigation";

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(PORTAL_LOGIN);

  const { range: rangeRaw } = await searchParams;
  const range = parsePortalRange(rangeRaw);
  const data = await getPortalHome(user.id, range);
  const firstName =
    user.firstName && user.firstName !== "there" ? user.firstName : "Host";

  return <PortalHomeDashboard firstName={firstName} data={data} />;
}

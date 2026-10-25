import { getCurrentUser } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SiteVisitBeacon } from "@/components/SiteVisitBeacon";
import { UsageBeacon } from "@/components/UsageBeacon";
import { isStaff } from "@/lib/roles";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteVisitBeacon />
      {user && !isStaff(user.role) ? <UsageBeacon kind="scroll" /> : null}
      <SiteHeader user={user} />
      {children}
      <SiteFooter />
    </>
  );
}

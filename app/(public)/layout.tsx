import { getCurrentUser } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SiteVisitBeacon } from "@/components/SiteVisitBeacon";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteVisitBeacon />
      <SiteHeader user={user} />
      {children}
      <SiteFooter />
    </>
  );
}

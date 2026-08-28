import { getCurrentUser } from "@/lib/auth";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      {children}
      <SiteFooter />
    </>
  );
}

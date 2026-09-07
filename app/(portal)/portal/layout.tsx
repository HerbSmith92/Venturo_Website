import { PortalChrome } from "@/components/portal/PortalChrome";
import { PortalNav } from "@/components/portal/PortalNav";
import { getCurrentUser } from "@/lib/auth";

export default async function PortalSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="portal-shell">
      <PortalChrome signedIn={Boolean(user)} />
      {user ? (
        <div className="portal-body">
          <PortalNav />
          <div className="portal-main">{children}</div>
        </div>
      ) : (
        <div className="portal-main">{children}</div>
      )}
    </div>
  );
}

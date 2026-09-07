import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event Host · Venturo",
  robots: { index: false, follow: false },
};

export default function PortalRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="portal-app">{children}</div>;
}

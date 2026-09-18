import type { Metadata, Viewport } from "next";
import { CompanionServiceWorker } from "@/components/companion/CompanionServiceWorker";
import { COMPANION_NAME } from "@/lib/companion";

export const metadata: Metadata = {
  title: COMPANION_NAME,
  description:
    "Scan tickets at the venue. Pull the guest list, keep it on the phone, & sync when you’re back online.",
  applicationName: COMPANION_NAME,
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Venturo Companion",
    statusBarStyle: "black-translucent",
  },
  manifest: "/companion-manifest.webmanifest",
  icons: {
    apple: "/brand/icons/companion-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2A2D35",
  viewportFit: "cover",
};

export default function CompanionRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <CompanionServiceWorker />
      {children}
    </>
  );
}

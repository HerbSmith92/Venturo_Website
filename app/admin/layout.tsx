import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Control Room · Venturo",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="control-room-app">{children}</div>;
}

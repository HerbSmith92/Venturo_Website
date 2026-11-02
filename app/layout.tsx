import type { Metadata } from "next";
import "./globals.css";
import { AuthCatcher } from "@/components/AuthCatcher";

export const metadata: Metadata = {
  title: "Venturo · Your Next Adventure Awaits",
  description:
    "Find things to do, events & communities. Taste the directory, then join free or as a Paid member.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA">
      <head>
        <link rel="preload" href="/brand/fonts/SocialGothic-Rough.otf" as="font" type="font/otf" crossOrigin="anonymous" />
        <link rel="preload" href="/brand/fonts/Nunito-ExtraLight.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthCatcher />
        {children}
      </body>
    </html>
  );
}

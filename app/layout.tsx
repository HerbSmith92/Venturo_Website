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
      <body>
        <AuthCatcher />
        {children}
      </body>
    </html>
  );
}

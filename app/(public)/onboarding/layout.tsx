import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  if (isStaff(user.role)) redirect("/admin");
  return children;
}

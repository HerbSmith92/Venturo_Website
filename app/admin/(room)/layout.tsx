import { requireGuideWriter } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { Suspense } from "react";

export default async function ControlRoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireGuideWriter();

  return (
    <div className="cr-shell">
      <Suspense fallback={null}>
        <AdminNav user={user} linkedAuthorId={user.linkedAuthorId} />
      </Suspense>
      <div className="cr-main">{children}</div>
    </div>
  );
}

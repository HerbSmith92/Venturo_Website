import { requireStaff } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function ControlRoomLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireStaff();

  return (
    <div className="cr-shell">
      <AdminNav user={user} />
      <div className="cr-main">{children}</div>
    </div>
  );
}

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function AdminLoginPage() {
  return (
    <main className="shell">
      <AdminLoginForm configured={isSupabaseConfigured()} />
    </main>
  );
}

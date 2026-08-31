import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function AccountResetPasswordPage() {
  return (
    <main className="shell">
      <ResetPasswordForm configured={isSupabaseConfigured()} mode="member" />
    </main>
  );
}

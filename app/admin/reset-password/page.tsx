import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function ResetPasswordPage() {
  return (
    <main className="shell">
      <ResetPasswordForm configured={isSupabaseConfigured()} />
    </main>
  );
}

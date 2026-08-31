import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function ForgotPasswordPage() {
  return (
    <main className="shell">
      <ForgotPasswordForm configured={isSupabaseConfigured()} />
    </main>
  );
}

import { AuthForm } from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function SignupPage() {
  return (
    <main className="shell">
      <AuthForm mode="signup" configured={isSupabaseConfigured()} />
    </main>
  );
}

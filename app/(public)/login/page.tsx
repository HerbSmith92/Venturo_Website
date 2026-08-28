import { AuthForm } from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="shell">
      <AuthForm mode="login" configured={isSupabaseConfigured()} />
    </main>
  );
}

import { AuthForm } from "@/components/AuthForm";

export function AuthSplit({
  configured,
  next,
  initialError = null,
}: {
  configured: boolean;
  next: string;
  initialError?: string | null;
}) {
  return (
    <div className="auth-split">
      <AuthForm mode="login" entry="email" configured={configured} next={next} initialError={initialError} />
      <AuthForm mode="signup" entry="email" configured={configured} next={next} />
    </div>
  );
}

import { AccountNav } from "@/components/AccountNav";
import { PrivacyTools } from "@/components/PrivacyTools";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/privacy");

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="privacy" />
        <p className="eyebrow">My Venturo</p>
        <h1>Privacy</h1>
        <p className="lede muted">
          Your profile, saves, and membership are one account on the website and in the app.
        </p>
        <p>
          <a href="/privacy_policy/">Read the privacy policy</a>
        </p>
        <h2>Export or delete</h2>
        <PrivacyTools />
        <form action="/auth/sign-out" method="post" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" type="submit">
            Sign Out
          </button>
        </form>
      </section>
    </main>
  );
}

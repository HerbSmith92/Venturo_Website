import { getStaffSession } from "@/lib/auth";

export default async function AdminDeniedPage() {
  const session = await getStaffSession();

  return (
    <main className="shell">
      <section className="auth-card">
        <img
          className="logo"
          src="/brand/logos/venturo-horizontal-light.svg"
          alt="Venturo"
          style={{ width: 160, marginBottom: 20 }}
        />
        <p className="eyebrow">Invite Only</p>
        <h1>This Login Is Not Staff</h1>
        <p className="lede muted">
          {session
            ? `${session.email ?? "This profile"} can use the public site. Control Room is for verified admins only.`
            : "Sign in with an invited admin account."}
        </p>
        <p className="muted">
          An existing admin sets <code>app_metadata.role</code> to <code>admin</code> on the
          user, then you sign out & log in again so the token picks it up.
        </p>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          <a className="btn btn-primary" href="/">
            Public Site
          </a>
          <a className="btn btn-secondary" href="/admin/login">
            Try Another Login
          </a>
        </div>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { linkedAuthorIdForUser } from "@/lib/control-room-authors";
import { isStaff } from "@/lib/roles";

export default async function AdminDeniedPage() {
  const session = await getStaffSession();
  if (session && !isStaff(session.role)) {
    const authorId = await linkedAuthorIdForUser(session.id);
    if (authorId) redirect(`/admin/authors/${authorId}`);
  }

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
        {session?.role === "member" ? (
          <p className="muted">
            Invited writers keep a member login. Open the invite link from your email, then you
            land on your Author card — don&apos;t use the staff Control Room login.
          </p>
        ) : (
          <p className="muted">
            An existing admin sets <code>app_metadata.role</code> to <code>admin</code> on the
            user, then you sign out & log in again so the token picks it up.
          </p>
        )}
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

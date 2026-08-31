import { MemberActions } from "@/components/admin/MemberActions";
import { getStaffSession } from "@/lib/auth";
import { formatClock, loadMembers } from "@/lib/control-room";
import { isAdmin } from "@/lib/roles";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  const canManage = isAdmin(session?.role);
  const { members, revenueCatReady, serviceRoleReady, loadError } = await loadMembers(
    params.q,
  );
  const paidCount = members.filter((member) => member.plan === "paid").length;
  const fullDirectory = serviceRoleReady && !loadError;

  return (
    <section>
      <p className="eyebrow">People</p>
      <h1>Members</h1>
      <p className="lede muted">
        Every auth user on the Venturo project. Paid status comes from RevenueCat.
        Reset Password emails a recovery link. Delete removes the auth user
        (profile cascades).
      </p>

      {params.error && <p className="error">{params.error}</p>}
      {params.done === "deleted" && <p className="notice">User deleted.</p>}
      {loadError && (
        <p className="notice">
          Showing profiles only. {loadError}{" "}
          {!serviceRoleReady && (
            <>
              Add <code>SUPABASE_SERVICE_ROLE_KEY</code> from Supabase → Project
              Settings → API Keys → Legacy <code>service_role</code> (Venturo
              Application) into <code>.env.local</code>, then restart{" "}
              <code>npm run dev</code>.
            </>
          )}
        </p>
      )}
      {fullDirectory && (
        <p className="notice">Full user directory loaded (emails, roles, manage actions).</p>
      )}
      {!revenueCatReady && (
        <p className="notice">
          RevenueCat secret is not set — everyone shows as Free until it is.
        </p>
      )}

      <div className="cr-stats" style={{ marginBottom: 24 }}>
        <article className="cr-stat">
          <span className="muted">Users</span>
          <strong>{members.length}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Paid</span>
          <strong>{paidCount}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Free</span>
          <strong>{members.length - paidCount}</strong>
        </article>
      </div>

      <form className="cr-panel" method="get" style={{ marginBottom: 20 }}>
        <label className="field">
          <span>Search</span>
          <input
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Name, email, or role"
          />
        </label>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Plan</th>
              <th>Onboarding</th>
              <th>Joined</th>
              <th>Last Sign In</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No users match.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.display_name || "Unnamed"}
                  {!member.email_confirmed && (
                    <span className="muted"> · unconfirmed</span>
                  )}
                </td>
                <td>{member.email || "—"}</td>
                <td>{member.role || "—"}</td>
                <td>
                  <span
                    className={
                      member.plan === "paid" ? "status-pill approved" : "status-pill"
                    }
                  >
                    {member.plan === "paid" ? "Paid" : "Free"}
                  </span>
                </td>
                <td>{member.onboarding_step}</td>
                <td>{formatClock(member.created_at)}</td>
                <td>{formatClock(member.last_sign_in_at)}</td>
                <td>
                  <MemberActions
                    userId={member.id}
                    email={member.email}
                    canManage={canManage}
                    isSelf={member.id === session?.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

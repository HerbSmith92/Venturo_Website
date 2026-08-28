import { inviteStaff } from "@/app/admin/actions";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
  const canInvite = isServiceRoleConfigured();

  return (
    <section>
      <p className="eyebrow">Invite Only</p>
      <h1>Staff</h1>
      <p className="lede muted">
        Admins & editors are created here. There is no public “register as
        admin”. Role is stored in <code>app_metadata</code> only.
      </p>
      {error && <p className="error">{error}</p>}
      {done && (
        <p className="notice">
          Invite sent. They set a password from the email, then log in at Control
          Room.
        </p>
      )}
      {!canInvite && (
        <p className="notice">
          Add the server-only <code>SUPABASE_SERVICE_ROLE_KEY</code> to
          <code> .env.local</code> to send invites from this page. Until then,
          grant admin in the SQL editor with
          <code> supabase/scripts/grant_control_room_admin.sql</code>.
        </p>
      )}
      <form className="cr-panel" action={inviteStaff}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required disabled={!canInvite} />
        </label>
        <label className="field">
          <span>Role</span>
          <select name="role" defaultValue="editor" disabled={!canInvite}>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={!canInvite}>
          Send Invite
        </button>
      </form>
    </section>
  );
}

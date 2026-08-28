import { formatClock, loadMembers } from "@/lib/control-room";

export default async function MembersPage() {
  const members = await loadMembers();

  return (
    <section>
      <p className="eyebrow">People</p>
      <h1>Members</h1>
      <p className="lede muted">
        Profiles on the same Supabase project as the app. Paid status lives in
        RevenueCat, not this table.
      </p>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Onboarding</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No profiles yet.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.display_name || "Unnamed"}</td>
                <td>{member.onboarding_step}</td>
                <td>{formatClock(member.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

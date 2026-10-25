import { getStaffSession } from "@/lib/auth";
import { loadControlRoomOverview } from "@/lib/overview/load";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AttentionQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; platform?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  const model = await loadControlRoomOverview(params, { admin: isAdmin(session?.role) });

  return (
    <section className="ops">
      <header className="ops-head">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Needs attention</h1>
          <p className="lede">
            {model.attention.length} open {model.attention.length === 1 ? "item" : "items"}
            {params.kind ? ` · ${params.kind}` : ""}. Customer access, money, and approaching events come first.
          </p>
        </div>
        <a href="/admin">Back to overview</a>
      </header>
      {model.banner ? <p className="notice">{model.banner}</p> : null}
      {model.attention.length === 0 ? <p className="ops-empty">Nothing in this queue.</p> : null}
      {model.attention.length > 0 ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Item</th>
                <th>Severity</th>
                <th>Age</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.attention.map((item) => (
                <tr key={item.id}>
                  <td data-label="Type">{item.type}</td>
                  <td data-label="Item">{item.item}</td>
                  <td data-label="Severity">{item.severity}</td>
                  <td data-label="Age">{item.age}</td>
                  <td data-label="Owner">{item.owner ?? "Not assigned"}</td>
                  <td>
                    <a href={item.href}>Resolve</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="ops-kicker">Assignment is shown only when the record already has an owner, such as an event host. A general assignment queue is not stored.</p>
    </section>
  );
}

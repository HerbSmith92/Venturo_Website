import { resolveEnquiry } from "@/app/admin/overview-actions";
import { formatClock, loadEnquiries } from "@/lib/control-room";

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const rows = await loadEnquiries();

  return (
    <section>
      <p className="eyebrow">Inbox</p>
      <h1>Enquiries</h1>
      <p className="lede muted">Messages from the public contact form. Resolving one keeps the message.</p>
      {params.done === "resolved" ? <p className="notice">Enquiry marked resolved.</p> : null}
      {params.error ? <p className="error">{params.error}</p> : null}
      <div className="cr-stack">
        {rows.length === 0 && <p className="muted">No enquiries yet.</p>}
        {rows.map((row) => (
          <article key={row.id} className="cr-panel">
            <p className="eyebrow">{row.kind === "business" ? "List A Business" : "Message Us Today"}</p>
            <h2>{row.name}</h2>
            <p className="muted">
              {row.email}
              {row.phone ? ` · ${row.phone}` : ""}
              {row.area ? ` · ${row.area}` : ""}
              {row.business_name ? ` · ${row.business_name}` : ""}
            </p>
            <p style={{ marginTop: 12 }}>{row.message}</p>
            <p className="muted" style={{ marginTop: 12 }}>
              {formatClock(row.created_at)}
              {row.resolved_at ? ` · Resolved ${formatClock(row.resolved_at)}` : ""}
            </p>
            {row.resolved_at ? null : (
              <form action={resolveEnquiry}>
                <input type="hidden" name="id" value={row.id} />
                <button className="btn btn-secondary" type="submit">
                  Mark resolved
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

import { formatClock, loadEnquiries } from "@/lib/control-room";

export default async function EnquiriesPage() {
  const rows = await loadEnquiries();

  return (
    <section>
      <p className="eyebrow">Inbox</p>
      <h1>Enquiries</h1>
      <p className="lede muted">Messages from the public contact form.</p>
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
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

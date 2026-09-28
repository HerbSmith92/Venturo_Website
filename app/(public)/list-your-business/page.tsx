export default function ListYourBusinessPage() {
  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Partners</p>
        <h1>List Your Business</h1>
        <p className="lede muted">
          Claim a place that is already in the directory, or host an event. Control Room
          publishes. You never go live on your own.
        </p>
        <div className="grid" style={{ marginTop: 28 }}>
          <article className="plan">
            <h2>Claim A Listing</h2>
            <p className="muted">Find your spot and send proof. Staff verify, then the app shows it.</p>
            <a className="btn btn-primary" href="/directory/claim">
              Find Your Listing
            </a>
          </article>
          <article className="plan">
            <h2>Create An Event</h2>
            <p className="muted">Draft the night, submit it, and open the door with Companion when it is live.</p>
            <a className="btn btn-secondary" href="/events/create">
              Start An Event
            </a>
          </article>
        </div>
      </section>
    </main>
  );
}

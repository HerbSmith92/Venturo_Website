import { getCurrentUser } from "@/lib/auth";

const TASTE = [
  {
    title: "Sunrise Crew",
    vibe: "Early hikers & coffee after",
    colour: "#45A67F",
  },
  {
    title: "Date Night Johannesburg",
    vibe: "Couples hunting quality time",
    colour: "#D54732",
  },
  {
    title: "Family Weekends",
    vibe: "Kids, parks, & easy plans",
    colour: "#DC729E",
  },
  {
    title: "After Dark",
    vibe: "Nightlife & late adventures",
    colour: "#5E589E",
  },
];

export default async function CommunitiesPage() {
  const user = await getCurrentUser();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">People First</p>
        <h1>Communities</h1>
        <p className="lede muted">
          Groups of curious locals who actually go do the thing. Browse the
          taste now — follow & member-only micro-events land with the app.
        </p>
        <div className="grid" style={{ marginTop: 28 }}>
          {TASTE.map((item) => (
            <article
              key={item.title}
              className="card"
              style={{ ["--card-accent" as string]: item.colour, padding: 0 }}
            >
              <div className="card-body" style={{ padding: "18px 16px 20px" }}>
                <p className="card-kicker" style={{ color: item.colour }}>
                  Community
                </p>
                <h3>{item.title}</h3>
                <p className="card-meta">{item.vibe}</p>
                <p className="member-price" style={{ marginTop: 10 }}>
                  Follow coming soon
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="hero-actions" style={{ marginTop: 32 }}>
          {user ? (
            <a className="btn btn-primary" href="/events">
              See What&apos;s On
            </a>
          ) : (
            <a className="btn btn-primary" href="/signup">
              Sign Up Free
            </a>
          )}
          <a className="btn btn-secondary" href="/directory">
            Taste The Directory
          </a>
        </div>
      </section>
    </main>
  );
}

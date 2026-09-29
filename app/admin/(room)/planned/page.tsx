export default async function PlannedScreen({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; group?: string }>;
}) {
  const { screen = "", group = "" } = await searchParams;
  const title = screen.trim() || "This screen";

  return (
    <section>
      <p className="eyebrow">{group.trim() || "Control Room"}</p>
      <h1>{title}</h1>
      <p className="lede muted">This screen is not built yet.</p>
    </section>
  );
}

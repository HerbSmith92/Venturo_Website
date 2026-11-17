export function ComingSoonScreen({
  group,
  title,
  body,
}: {
  group: string;
  title: string;
  body: string;
}) {
  return (
    <section className="cr-manage">
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">{group}</p>
          <h1>{title}</h1>
          <p className="lede muted">{body}</p>
        </div>
      </header>
      <p className="notice" role="status">
        Shared managers are in place. This editor lands in the next build phase.
      </p>
    </section>
  );
}

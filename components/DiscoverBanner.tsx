export function DiscoverBanner({
  eyebrow,
  title,
  copy,
  image,
  imageAlt,
  actions,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
  imageAlt: string;
  actions: Array<{ label: string; href: string; primary?: boolean }>;
}) {
  return (
    <section className="discover-banner discover-banner-refresh">
      <div className="discover-banner-art">
        <img src={image} alt={imageAlt} />
      </div>
      <div className="discover-banner-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        <div className="hero-actions">
          {actions.map((action) => (
            <a
              className={`btn ${action.primary ? "btn-primary" : "btn-secondary"}`}
              href={action.href}
              key={action.href}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

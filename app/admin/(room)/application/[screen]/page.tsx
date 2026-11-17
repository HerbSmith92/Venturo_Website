import { requireAdmin } from "@/lib/auth";
import { isAppHomeScreen, loadAppHomeAdmin, type AppHomeScreen } from "@/lib/app-home";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SCREENS: Record<AppHomeScreen, string> = {
  discover: "Discover",
  events: "Events",
  community: "Community",
};

const LINKS = [
  { slug: "banner", label: "Banner", connected: true },
  { slug: "hot-on-venturo", label: "Hot on Venturo", connected: true },
  { slug: "featured", label: "Featured", connected: true },
  { slug: "add-row-listing", label: "Add Row Listing", connected: true },
  { slug: "settings", label: "Settings", connected: true },
] as const;

export default async function ApplicationScreenPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  await requireAdmin();
  const { screen } = await params;
  if (!isAppHomeScreen(screen)) notFound();
  const title = SCREENS[screen];
  const home = await loadAppHomeAdmin(screen);
  const customCount = home.rows.filter((row) => row.row_kind === "custom").length;

  return (
    <section className="cr-manage">
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Application View</p>
          <h1>{title}</h1>
          <p className="lede muted">
            App tab content for {title}. Website homepage curation stays on{" "}
            <a href="/admin/website">/admin/website</a>.
          </p>
        </div>
      </header>
      <p className="notice" role="status">
        {home.banners.length} banner{home.banners.length === 1 ? "" : "s"} · {customCount} custom row
        {customCount === 1 ? "" : "s"} · public feed <code>/api/app/home?screen={screen}</code>
      </p>
      <div className="grid">
        {LINKS.map((link) => (
          <article className="card" key={link.slug}>
            <div className="card-body">
              <h2>{link.label}</h2>
              <p className="muted">
                {link.slug === "banner"
                  ? "Carousel banners with schedule, destination & focal point."
                  : link.slug === "hot-on-venturo"
                    ? "Automatic rules or manual curation for Hot on Venturo."
                    : link.slug === "featured"
                      ? "Manual featured list with publish & schedule windows."
                      : link.slug === "add-row-listing"
                        ? "Seasonal & filter-based custom rows."
                        : "Section order, visibility, limits & empty behaviour."}
              </p>
              <Link className="btn btn-secondary" href={`/admin/application/${screen}/${link.slug}`}>
                Open {link.label}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
